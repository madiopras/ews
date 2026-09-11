#!/usr/bin/env python3
"""Safe local verification for configuration, imports, and MongoDB connectivity."""

import asyncio

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import load_settings


async def main() -> int:
    print("Quick backend verification")
    settings = load_settings()
    print(f"configuration: ok ({settings.environment})")
    print(f"database config: {settings.db_name} (credentials hidden)")

    client = AsyncIOMotorClient(settings.mongo_url, serverSelectionTimeoutMS=5000)
    try:
        await client.admin.command("ping")
        print("mongodb: connected")
    except Exception as error:
        print(f"mongodb: unavailable ({type(error).__name__})")
        return 1
    finally:
        client.close()

    from app.main import app

    assert app.title == "Explore Wisata Sumut API"
    print("application import: ok (app.main:app)")
    print("start: python -m uvicorn app.main:app --host 0.0.0.0 --port 8000")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
