from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import os
import uuid
import bcrypt
import jwt
import logging

# ---------------- Setup ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Explore Wisata Sumut API")
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------- Password / JWT helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user["_id"])
        del user["_id"]
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 3600,
        path="/",
    )


# ---------------- Schemas ----------------
Category = Literal["nature", "beach", "culture", "culinary", "adventure"]


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str


class DestinationIn(BaseModel):
    name: str
    name_en: Optional[str] = ""
    location: str
    category: Category
    price: float
    description: str
    description_en: Optional[str] = ""
    images: List[str] = Field(default_factory=list)
    latitude: float
    longitude: float
    featured: bool = False


class DestinationOut(DestinationIn):
    id: str
    created_at: str


# ---------------- Auth endpoints ----------------
@api_router.post("/auth/register", response_model=UserOut)
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": "user",
        "wishlist": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    token = create_access_token(uid, email)
    set_auth_cookie(response, token)
    return UserOut(id=uid, email=email, name=payload.name, role="user")


@api_router.post("/auth/login", response_model=UserOut)
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    uid = str(user["_id"])
    token = create_access_token(uid, email)
    set_auth_cookie(response, token)
    return UserOut(id=uid, email=email, name=user["name"], role=user.get("role", "user"))


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(id=user["id"], email=user["email"], name=user["name"], role=user.get("role", "user"))


# ---------------- Destinations ----------------
def dest_to_out(d: dict) -> DestinationOut:
    return DestinationOut(
        id=str(d["_id"]),
        name=d["name"],
        name_en=d.get("name_en", ""),
        location=d["location"],
        category=d["category"],
        price=d["price"],
        description=d["description"],
        description_en=d.get("description_en", ""),
        images=d.get("images", []),
        latitude=d["latitude"],
        longitude=d["longitude"],
        featured=d.get("featured", False),
        created_at=d.get("created_at", ""),
    )


@api_router.get("/destinations", response_model=List[DestinationOut])
async def list_destinations(
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    search: Optional[str] = None,
    featured: Optional[bool] = None,
):
    q = {}
    if category and category != "all":
        q["category"] = category
    if min_price is not None or max_price is not None:
        price_q = {}
        if min_price is not None:
            price_q["$gte"] = min_price
        if max_price is not None:
            price_q["$lte"] = max_price
        q["price"] = price_q
    if featured is not None:
        q["featured"] = featured
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"location": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.destinations.find(q).sort("created_at", -1).to_list(500)
    return [dest_to_out(d) for d in docs]


@api_router.get("/destinations/{dest_id}", response_model=DestinationOut)
async def get_destination(dest_id: str):
    try:
        doc = await db.destinations.find_one({"_id": ObjectId(dest_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return dest_to_out(doc)


@api_router.post("/destinations", response_model=DestinationOut)
async def create_destination(payload: DestinationIn, admin: dict = Depends(require_admin)):
    doc = payload.model_dump()
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.destinations.insert_one(doc)
    doc["_id"] = res.inserted_id
    return dest_to_out(doc)


@api_router.put("/destinations/{dest_id}", response_model=DestinationOut)
async def update_destination(dest_id: str, payload: DestinationIn, admin: dict = Depends(require_admin)):
    try:
        oid = ObjectId(dest_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    doc = payload.model_dump()
    await db.destinations.update_one({"_id": oid}, {"$set": doc})
    updated = await db.destinations.find_one({"_id": oid})
    if not updated:
        raise HTTPException(status_code=404, detail="Not found")
    return dest_to_out(updated)


@api_router.delete("/destinations/{dest_id}")
async def delete_destination(dest_id: str, admin: dict = Depends(require_admin)):
    try:
        res = await db.destinations.delete_one({"_id": ObjectId(dest_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------------- Wishlist ----------------
@api_router.get("/wishlist", response_model=List[DestinationOut])
async def get_wishlist(user: dict = Depends(get_current_user)):
    ids = user.get("wishlist", [])
    if not ids:
        return []
    oids = []
    for i in ids:
        try:
            oids.append(ObjectId(i))
        except Exception:
            continue
    docs = await db.destinations.find({"_id": {"$in": oids}}).to_list(500)
    return [dest_to_out(d) for d in docs]


@api_router.post("/wishlist/{dest_id}")
async def add_wishlist(dest_id: str, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$addToSet": {"wishlist": dest_id}},
    )
    return {"ok": True}


@api_router.delete("/wishlist/{dest_id}")
async def remove_wishlist(dest_id: str, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$pull": {"wishlist": dest_id}},
    )
    return {"ok": True}


# ---------------- Startup: indexes, admin seed, sample data ----------------
SAMPLE_DESTINATIONS = [
    {
        "name": "Danau Toba",
        "name_en": "Lake Toba",
        "location": "Kabupaten Toba, Sumatera Utara",
        "category": "nature",
        "price": 50000,
        "description": "Danau vulkanik terbesar di Asia Tenggara, terbentuk dari letusan supervulkan puluhan ribu tahun lalu. Nikmati pemandangan air biru, perbukitan hijau, dan budaya Batak yang kaya di Pulau Samosir.",
        "description_en": "The largest volcanic lake in Southeast Asia, formed from a supervolcano eruption tens of thousands of years ago. Enjoy blue waters, green hills, and rich Batak culture on Samosir Island.",
        "images": [
            "https://images.unsplash.com/photo-1592639298199-7b9d01c1cf29?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwzfHxsYWtlJTIwdG9iYSUyMGluZG9uZXNpYXxlbnwwfHx8fDE3ODY5Mzk0Njl8MA&ixlib=rb-4.1.0&q=85",
            "https://images.pexels.com/photos/33562774/pexels-photo-33562774.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        ],
        "latitude": 2.6540,
        "longitude": 98.8756,
        "featured": True,
    },
    {
        "name": "Pantai Cermin",
        "name_en": "Cermin Beach",
        "location": "Serdang Bedagai, Sumatera Utara",
        "category": "beach",
        "price": 25000,
        "description": "Pantai berpasir putih dengan air yang tenang dan jernih seperti cermin. Cocok untuk keluarga, dengan wahana air, resor, dan kuliner seafood segar di sepanjang bibir pantai.",
        "description_en": "A white sandy beach with calm, mirror-clear waters. Perfect for families with water rides, resorts, and fresh seafood along the shore.",
        "images": [
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80",
            "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1400&q=80",
        ],
        "latitude": 3.6350,
        "longitude": 98.9420,
        "featured": True,
    },
    {
        "name": "Istana Maimun",
        "name_en": "Maimun Palace",
        "location": "Medan, Sumatera Utara",
        "category": "culture",
        "price": 15000,
        "description": "Istana Kesultanan Deli yang dibangun tahun 1888 dengan perpaduan arsitektur Melayu, Islam, Spanyol, India, dan Italia. Ikon sejarah kota Medan yang wajib dikunjungi.",
        "description_en": "The Deli Sultanate palace built in 1888, blending Malay, Islamic, Spanish, Indian, and Italian architecture. A must-visit historical icon of Medan city.",
        "images": [
            "https://images.pexels.com/photos/8679204/pexels-photo-8679204.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
            "https://images.pexels.com/photos/37820758/pexels-photo-37820758.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        ],
        "latitude": 3.5752,
        "longitude": 98.6836,
        "featured": True,
    },
    {
        "name": "Tip Top Restaurant",
        "name_en": "Tip Top Restaurant",
        "location": "Jl. Ahmad Yani, Medan",
        "category": "culinary",
        "price": 75000,
        "description": "Restoran legendaris sejak 1934 di kawasan Kesawan. Sajikan menu Indonesia, Belanda, dan Tionghoa dengan suasana kolonial yang kental. Wajib coba es krim Tip Top dan bistik lidahnya.",
        "description_en": "A legendary restaurant since 1934 in Kesawan district. Serves Indonesian, Dutch, and Chinese menus with a strong colonial atmosphere. Must-try: Tip Top ice cream and tongue steak.",
        "images": [
            "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80",
            "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1400&q=80",
        ],
        "latitude": 3.5867,
        "longitude": 98.6789,
        "featured": False,
    },
    {
        "name": "Bukit Lawang",
        "name_en": "Bukit Lawang",
        "location": "Langkat, Sumatera Utara",
        "category": "adventure",
        "price": 150000,
        "description": "Pintu gerbang menuju Taman Nasional Gunung Leuser, rumah bagi orangutan Sumatera yang terancam punah. Trekking jungle, arung jeram di Sungai Bahorok, dan menginap di eco-lodge tepi hutan.",
        "description_en": "Gateway to Gunung Leuser National Park, home to the endangered Sumatran orangutan. Jungle trekking, tubing on Bahorok River, and staying in riverside eco-lodges.",
        "images": [
            "https://images.unsplash.com/photo-1723153247780-02e191e1dd0c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHwzfHxidWtpdCUyMGxhd2FuZyUyMGp1bmdsZXxlbnwwfHx8fDE3ODY5Mzk0Njl8MA&ixlib=rb-4.1.0&q=85",
            "https://images.pexels.com/photos/37866119/pexels-photo-37866119.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        ],
        "latitude": 3.5497,
        "longitude": 98.1289,
        "featured": True,
    },
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@wisatasumut.id")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "wishlist": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin seeded: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}},
        )

    # Seed destinations if empty
    count = await db.destinations.count_documents({})
    if count == 0:
        docs = []
        now = datetime.now(timezone.utc).isoformat()
        for d in SAMPLE_DESTINATIONS:
            docs.append({**d, "created_at": now})
        await db.destinations.insert_many(docs)
        logger.info(f"Seeded {len(docs)} destinations")


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ---------------- Health ----------------
@api_router.get("/")
async def root():
    return {"message": "Explore Wisata Sumut API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
