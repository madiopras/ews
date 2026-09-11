"""Idempotent database initialization for the application lifespan."""

import asyncio
import logging
import os
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import FastAPI

from app.core import security
from app.infrastructure.database.indexes import ensure_indexes
from app.modules.administration.repositories import AuditLogRepository
from app.modules.administration.service import AuditService
from app.modules.billing.schemas import DEFAULT_PLANS

logger = logging.getLogger(__name__)

DEFAULT_EMAIL_TEMPLATES = [
    {
        "key": "welcome",
        "name": "Welcome",
        "subject_id": "Selamat datang di {{site_name}}",
        "subject_en": "Welcome to {{site_name}}",
        "body_id": "Halo {{name}},\n\nAkun Anda telah berhasil dibuat.",
        "body_en": "Hello {{name}},\n\nYour account has been created successfully.",
        "enabled": True,
    },
    {
        "key": "partner_approved",
        "name": "Partner approved",
        "subject_id": "Pendaftaran partner Anda disetujui",
        "subject_en": "Your partner application was approved",
        "body_id": "Halo {{business_name}},\n\nPendaftaran partner Anda telah disetujui.",
        "body_en": "Hello {{business_name}},\n\nYour partner application has been approved.",
        "enabled": True,
    },
    {
        "key": "partner_rejected",
        "name": "Partner rejected",
        "subject_id": "Pembaruan pendaftaran partner",
        "subject_en": "Partner application update",
        "body_id": "Halo {{business_name}},\n\nPendaftaran Anda belum dapat kami setujui.",
        "body_en": "Hello {{business_name}},\n\nWe are unable to approve your application at this time.",
        "enabled": True,
    },
]


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


async def migrate_partner_memberships(database) -> None:
    """Idempotently bridge legacy owner fields into explicit memberships."""
    now = datetime.now(timezone.utc).isoformat()
    async for partner in database.partners.find({}):
        partner_id = str(partner["_id"])
        owner_user_id = partner.get("owner_user_id", "")
        owner_exists = False
        if owner_user_id:
            try:
                owner_exists = (
                    await database.users.find_one(
                        {"_id": ObjectId(owner_user_id)}, {"_id": 1}
                    )
                    is not None
                )
            except Exception:
                owner_exists = False
        if owner_exists:
            await database.partner_memberships.update_one(
                {"partner_id": partner_id, "user_id": owner_user_id},
                {
                    "$set": {"role": "owner", "status": "active", "updated_at": now},
                    "$setOnInsert": {"created_at": now},
                },
                upsert=True,
            )
            await database.partners.update_one(
                {"_id": partner["_id"]},
                {"$set": {"ownership_status": "claimed", "ownership_migrated_at": now}},
            )
        else:
            changes = {"ownership_status": "unclaimed", "ownership_migrated_at": now}
            if owner_user_id:
                changes["legacy_owner_user_id"] = owner_user_id
            await database.partners.update_one(
                {"_id": partner["_id"]}, {"$set": changes}
            )


async def initialize_application(application: FastAPI) -> None:
    """Initialize indexes and backward-compatible seed data using app-owned state."""
    database = application.state.database
    settings = application.state.settings
    await ensure_indexes(database)
    await database.users.update_many(
        {"account_active": {"$exists": False}}, {"$set": {"account_active": True}}
    )

    admin_email = settings.admin_email
    admin_password = settings.admin_password.get_secret_value()
    existing = await database.users.find_one({"email": admin_email})
    if not existing:
        await database.users.insert_one(
            {
                "email": admin_email,
                "password_hash": await asyncio.to_thread(
                    security.hash_password, admin_password
                ),
                "name": "Admin",
                "role": "admin",
                "account_active": True,
                "wishlist": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        logger.info("Default administrator initialized")
    elif not await asyncio.to_thread(
        security.verify_password, admin_password, existing.get("password_hash", "")
    ):
        await database.users.update_one(
            {"email": admin_email},
            {
                "$set": {
                    "password_hash": await asyncio.to_thread(
                        security.hash_password, admin_password
                    ),
                    "role": "admin",
                    "account_active": True,
                }
            },
        )
    elif (
        existing.get("role") != "admin" or existing.get("account_active", True) is False
    ):
        await database.users.update_one(
            {"email": admin_email}, {"$set": {"role": "admin", "account_active": True}}
        )

    await migrate_partner_memberships(database)
    if await database.premium_plans.count_documents({}) == 0:
        await database.premium_plans.insert_many([dict(plan) for plan in DEFAULT_PLANS])
        logger.info("Premium plans initialized")
    if await database.email_templates.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        await database.email_templates.insert_many(
            [
                {**template, "created_at": now, "updated_at": now}
                for template in DEFAULT_EMAIL_TEMPLATES
            ]
        )
        logger.info("Email templates initialized")
    if await database.destinations.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        await database.destinations.insert_many(
            [
                {**destination, "is_active": True, "created_at": now}
                for destination in SAMPLE_DESTINATIONS
            ]
        )
        logger.info("Sample destinations initialized")

    backup_directory = settings.backup_dir.resolve()
    await asyncio.to_thread(backup_directory.mkdir, parents=True, exist_ok=True)
    backup_ready = await asyncio.to_thread(os.access, backup_directory, os.W_OK)
    await AuditService(AuditLogRepository(database), settings).system(
        "info",
        "application",
        "Application startup completed",
        {"backup_directory_ready": backup_ready},
    )
