from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
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
import json
import logging
import requests
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

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


@api_router.get("/destinations/trending", response_model=List[DestinationOut])
async def trending(days: int = 30, limit: int = 6):
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": "$destination_id", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
        {"$limit": limit},
    ]
    rows = await db.wishlist_events.aggregate(pipeline).to_list(limit)
    if not rows:
        return []
    order = {r["_id"]: i for i, r in enumerate(rows)}
    oids = []
    for r in rows:
        try:
            oids.append(ObjectId(r["_id"]))
        except Exception:
            continue
    docs = await db.destinations.find({"_id": {"$in": oids}}).to_list(len(oids))
    docs.sort(key=lambda d: order.get(str(d["_id"]), 999))
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
    # Log event for trending computation
    await db.wishlist_events.insert_one({
        "user_id": user["id"],
        "destination_id": dest_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


# ---------------- Trending ----------------
# (Moved above /destinations/{dest_id} to avoid route shadowing)


# ---------------- Partners ----------------
PartnerType = Literal["guide", "rental", "homestay"]


class PartnerIn(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=120)
    type: PartnerType
    whatsapp: str = Field(..., min_length=8, max_length=20)  # digits only, with country code e.g. 6281...
    description: str = Field(..., min_length=10, max_length=1000)
    city: str = Field(..., max_length=120)
    destination_ids: List[str] = Field(default_factory=list)
    image: Optional[str] = ""


class PartnerOut(BaseModel):
    id: str
    business_name: str
    type: str
    whatsapp: str
    description: str
    city: str
    destination_ids: List[str]
    image: Optional[str] = ""
    status: str
    created_at: str


def partner_to_out(d: dict) -> PartnerOut:
    return PartnerOut(
        id=str(d["_id"]),
        business_name=d["business_name"],
        type=d["type"],
        whatsapp=d["whatsapp"],
        description=d["description"],
        city=d["city"],
        destination_ids=d.get("destination_ids", []),
        image=d.get("image", ""),
        status=d.get("status", "pending"),
        created_at=d.get("created_at", ""),
    )


@api_router.post("/partners", response_model=PartnerOut)
async def register_partner(payload: PartnerIn):
    wa = "".join(ch for ch in payload.whatsapp if ch.isdigit())
    if not wa:
        raise HTTPException(status_code=400, detail="Invalid whatsapp number")
    doc = payload.model_dump()
    doc["whatsapp"] = wa
    doc["status"] = "pending"
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.partners.insert_one(doc)
    doc["_id"] = res.inserted_id
    return partner_to_out(doc)


@api_router.get("/partners", response_model=List[PartnerOut])
async def list_partners(
    destination_id: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = "approved",
):
    q = {}
    if status and status != "all":
        q["status"] = status
    if destination_id:
        q["destination_ids"] = destination_id
    if type:
        q["type"] = type
    docs = await db.partners.find(q).sort("created_at", -1).to_list(500)
    return [partner_to_out(d) for d in docs]


@api_router.get("/partners/admin", response_model=List[PartnerOut])
async def list_partners_admin(admin: dict = Depends(require_admin)):
    docs = await db.partners.find({}).sort("created_at", -1).to_list(1000)
    return [partner_to_out(d) for d in docs]


class PartnerStatusIn(BaseModel):
    status: Literal["approved", "rejected", "pending"]


@api_router.patch("/partners/{partner_id}/status", response_model=PartnerOut)
async def update_partner_status(
    partner_id: str, payload: PartnerStatusIn, admin: dict = Depends(require_admin)
):
    try:
        oid = ObjectId(partner_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    await db.partners.update_one({"_id": oid}, {"$set": {"status": payload.status}})
    updated = await db.partners.find_one({"_id": oid})
    if not updated:
        raise HTTPException(status_code=404, detail="Not found")
    return partner_to_out(updated)


@api_router.delete("/partners/{partner_id}")
async def delete_partner(partner_id: str, admin: dict = Depends(require_admin)):
    try:
        res = await db.partners.delete_one({"_id": ObjectId(partner_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------------- Saved Itineraries ----------------
class ItineraryIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    days: int = Field(..., ge=1, le=30)
    budget: float = Field(..., ge=0)
    interests: List[str] = Field(default_factory=list)
    content: str = Field(..., min_length=1)
    lang: Literal["id", "en"] = "id"


class ItineraryOut(BaseModel):
    id: str
    user_id: str
    title: str
    days: int
    budget: float
    interests: List[str]
    content: str
    lang: str
    created_at: str


def itin_to_out(d: dict) -> ItineraryOut:
    return ItineraryOut(
        id=str(d["_id"]),
        user_id=d["user_id"],
        title=d["title"],
        days=d["days"],
        budget=d["budget"],
        interests=d.get("interests", []),
        content=d["content"],
        lang=d.get("lang", "id"),
        created_at=d["created_at"],
    )


@api_router.post("/itineraries", response_model=ItineraryOut)
async def save_itinerary(payload: ItineraryIn, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc["user_id"] = user["id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.itineraries.insert_one(doc)
    doc["_id"] = res.inserted_id
    return itin_to_out(doc)


@api_router.get("/itineraries", response_model=List[ItineraryOut])
async def list_itineraries(user: dict = Depends(get_current_user)):
    docs = await db.itineraries.find({"user_id": user["id"]}).sort("created_at", -1).to_list(500)
    return [itin_to_out(d) for d in docs]


@api_router.delete("/itineraries/{itin_id}")
async def delete_itinerary(itin_id: str, user: dict = Depends(get_current_user)):
    try:
        oid = ObjectId(itin_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    d = await db.itineraries.find_one({"_id": oid})
    if not d:
        raise HTTPException(status_code=404, detail="Not found")
    if d["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.itineraries.delete_one({"_id": oid})
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

    # Init object storage
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

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


# ---------------- Object Storage (Emergent) ----------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = os.environ.get("APP_NAME", "explore-sumut")
_storage_key = None


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    if not EMERGENT_KEY:
        raise RuntimeError("EMERGENT_LLM_KEY missing")
    resp = requests.post(
        f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30
    )
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 404:
        # Stale key
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


MIME_MAP = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp",
}


@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    ext = (file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "bin").lower()
    if ext not in MIME_MAP:
        raise HTTPException(status_code=400, detail="Only images (jpg, png, gif, webp) allowed")
    content_type = MIME_MAP[ext]
    path = f"{APP_NAME}/uploads/{admin['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Max file size 8MB")
    result = put_object(path, data, content_type)
    stored_path = result["path"]
    await db.files.insert_one({
        "storage_path": stored_path,
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "uploaded_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"path": stored_path, "url": f"/api/files/{stored_path}"}


@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    try:
        data, content_type = get_object(path)
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 500
        raise HTTPException(status_code=404 if code == 404 else 502, detail="File error")
    return Response(content=data, media_type=content_type, headers={"Cache-Control": "public, max-age=86400"})


# ---------------- Reviews ----------------
class ReviewIn(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field(..., min_length=1, max_length=1000)


class ReviewOut(BaseModel):
    id: str
    destination_id: str
    user_id: str
    user_name: str
    rating: int
    comment: str
    created_at: str


def review_to_out(r: dict) -> ReviewOut:
    return ReviewOut(
        id=str(r["_id"]),
        destination_id=r["destination_id"],
        user_id=r["user_id"],
        user_name=r["user_name"],
        rating=r["rating"],
        comment=r["comment"],
        created_at=r["created_at"],
    )


@api_router.get("/destinations/{dest_id}/reviews")
async def list_reviews(dest_id: str):
    docs = await db.reviews.find({"destination_id": dest_id}).sort("created_at", -1).to_list(500)
    reviews = [review_to_out(d).model_dump() for d in docs]
    if reviews:
        avg = sum(r["rating"] for r in reviews) / len(reviews)
    else:
        avg = 0
    return {"reviews": reviews, "average": round(avg, 1), "count": len(reviews)}


@api_router.post("/destinations/{dest_id}/reviews", response_model=ReviewOut)
async def create_review(dest_id: str, payload: ReviewIn, user: dict = Depends(get_current_user)):
    try:
        dest = await db.destinations.find_one({"_id": ObjectId(dest_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
    doc = {
        "destination_id": dest_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "rating": payload.rating,
        "comment": payload.comment,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.reviews.insert_one(doc)
    doc["_id"] = res.inserted_id
    return review_to_out(doc)


@api_router.delete("/reviews/{review_id}")
async def delete_review(review_id: str, user: dict = Depends(get_current_user)):
    try:
        oid = ObjectId(review_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    r = await db.reviews.find_one({"_id": oid})
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    if r["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.reviews.delete_one({"_id": oid})
    return {"ok": True}


# ---------------- AI Trip Planner ----------------
class TripPlanIn(BaseModel):
    days: int = Field(..., ge=1, le=14)
    budget: float = Field(..., ge=0)
    interests: List[str] = Field(default_factory=list)  # e.g. ['nature','culture','culinary']
    lang: Literal["id", "en"] = "id"


@api_router.post("/trip-planner/stream")
async def trip_planner_stream(payload: TripPlanIn):
    # Fetch all destinations from DB
    docs = await db.destinations.find({}).to_list(500)
    if not docs:
        raise HTTPException(status_code=400, detail="No destinations available")

    catalog_items = []
    for d in docs:
        catalog_items.append({
            "id": str(d["_id"]),
            "name": d["name"],
            "name_en": d.get("name_en", ""),
            "location": d["location"],
            "category": d["category"],
            "price": d["price"],
            "description": d["description"][:300],
        })
    catalog_json = json.dumps(catalog_items, ensure_ascii=False, indent=2)

    if payload.lang == "id":
        system_msg = (
            "Kamu adalah trip planner ahli untuk wisata Sumatera Utara. "
            "Kamu HANYA boleh merekomendasikan destinasi dari katalog JSON yang diberikan. "
            "JANGAN mengarang atau menyebut tempat lain di luar katalog. "
            "Susun itinerary yang realistis, kelompokkan destinasi yang berdekatan, "
            "dan hormati total budget user. "
            "Format output: Markdown dengan heading `## Hari 1`, `## Hari 2`, dst. "
            "Untuk setiap destinasi: **Nama** (kategori) — lokasi, Rp harga. Tambahkan 1-2 kalimat rekomendasi. "
            "Di akhir tambahkan bagian `### Total Estimasi Biaya` dan `### Tips Perjalanan`.\n\n"
            f"KATALOG DESTINASI:\n{catalog_json}"
        )
        user_text = (
            f"Rencanakan trip {payload.days} hari di Sumatera Utara. "
            f"Total budget: Rp {int(payload.budget):,}. "
            f"Minat utama: {', '.join(payload.interests) if payload.interests else 'semua kategori'}. "
            "Gunakan HANYA destinasi dari katalog."
        )
    else:
        system_msg = (
            "You are an expert trip planner for North Sumatra tourism. "
            "You may ONLY recommend destinations from the provided JSON catalog. "
            "DO NOT invent or mention any place outside the catalog. "
            "Design a realistic itinerary, group nearby destinations, "
            "and respect the user's total budget. "
            "Output format: Markdown with headings `## Day 1`, `## Day 2`, etc. "
            "For each destination: **Name** (category) — location, IDR price. Add 1-2 sentence recommendation. "
            "End with `### Estimated Total Cost` and `### Travel Tips`.\n\n"
            f"DESTINATION CATALOG:\n{catalog_json}"
        )
        user_text = (
            f"Plan a {payload.days}-day trip in North Sumatra. "
            f"Total budget: IDR {int(payload.budget):,}. "
            f"Main interests: {', '.join(payload.interests) if payload.interests else 'all categories'}. "
            "Use ONLY destinations from the catalog."
        )

    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=f"trip-{uuid.uuid4()}",
        system_message=system_msg,
    ).with_model("anthropic", "claude-sonnet-4-6")

    async def event_gen():
        try:
            async for ev in chat.stream_message(UserMessage(text=user_text)):
                if isinstance(ev, TextDelta):
                    yield f"data: {json.dumps({'text': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    yield f"data: {json.dumps({'done': True})}\n\n"
                    break
        except Exception as e:
            logger.error(f"Trip planner error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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
