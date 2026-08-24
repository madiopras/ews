from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from bson import ObjectId
from typing import List, Optional
import jwt
from datetime import datetime, timedelta

# Setup DB
client = AsyncIOMotorClient("mongodb://admin:admin123@localhost:27017/wisasumut?authSource=admin")
db = client["wisatasumut"]

# Models
class UserOut(BaseModel):
    id: str
    email: str
    role: str

class LoginIn(BaseModel):
    email: str
    password: str

class DestinasiOut(BaseModel):
    id: str
    name: str
    is_active: bool

# Router
api_router = APIRouter()

# Dummy auth — in production: verify against DB
async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, "secret-key", algorithms=["HS256"])
        return {"id": payload["sub"], "email": payload["email"], "role": payload.get("role", "user")}
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")

@api_router.post("/auth/login")
async def login(payload: LoginIn):
    # Dummy check: accept any email/password
    # In real app: query db.users.find_one({email: payload.email, password_hash: hash})
    if payload.email and payload.password:
        token = jwt.encode(
            {
                "sub": "admin123",
                "email": payload.email,
                "role": "admin",
                "exp": datetime.utcnow() + timedelta(hours=24)
            },
            "secret-key",
            algorithm="HS256"
        )
        return {"access_token": token, "token_type": "bearer"}
    raise HTTPException(400, "Invalid credentials")

@api_router.get("/auth/me", response_model=UserOut)
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "role": current_user["role"]
    }

@api_router.get("/destinations", response_model=List[DestinasiOut])
async def list_destinations():
    docs = await db.destinations.find({"is_active": True}).to_list(50)
    return [
        {
            "id": str(d["_id"]),
            "name": d.get("name", "Unknown"),
            "is_active": d.get("is_active", True)
        }
        for d in docs
    ]

@api_router.patch("/destinations/{id}/toggle-active")
async def toggle_destination_active(id: str):
    try:
        obj_id = ObjectId(id)
        dest = await db.destinations.find_one({"_id": obj_id})
        if not dest:
            raise HTTPException(404, "Destination not found")
        new_status = not dest.get("is_active", False)
        await db.destinations.update_one({"_id": obj_id}, {"$set": {"is_active": new_status}})
        return {"success": True, "is_active": new_status}
    except Exception as e:
        raise HTTPException(500, str(e))

# App
app = FastAPI(title="Minimal EWS")
app.include_router(api_router, prefix="/api")

@app.get("/health")
async def health():
    return {"status": "ok"}

from fastapi import FastAPI, APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from bson import ObjectId
from typing import List

# Setup DB
client = AsyncIOMotorClient("mongodb://admin:admin123@localhost:27017/wisasumut?authSource=admin")
db = client["wisatasumut"]

# Models
class DestinasiOut(BaseModel):
    id: str
    name: str
    is_active: bool

# Router
api_router = APIRouter()

@api_router.get("/destinations", response_model=List[DestinasiOut])
async def list_destinations():
    docs = await db.destinations.find({"is_active": True}).to_list(50)
    return [
        {
            "id": str(d["_id"]),
            "name": d.get("name", "Unknown"),
            "is_active": d.get("is_active", True)
        }
        for d in docs
    ]

@api_router.patch("/destinations/{id}/toggle-active")
async def toggle_destination_active(id: str):
    try:
        obj_id = ObjectId(id)
        dest = await db.destinations.find_one({"_id": obj_id})
        if not dest:
            raise HTTPException(404, "Destination not found")
        new_status = not dest.get("is_active", False)
        await db.destinations.update_one({"_id": obj_id}, {"$set": {"is_active": new_status}})
        return {"success": True, "is_active": new_status}
    except Exception as e:
        raise HTTPException(500, str(e))

# App
app = FastAPI(title="Minimal EWS")
app.include_router(api_router, prefix="/api")

@app.get("/health")
async def health():
    return {"status": "ok"}
