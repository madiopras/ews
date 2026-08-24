#!/usr/bin/env python3
"""
Migrasi MongoDB: tambah field 'is_active' ke collection destinations dan partners.

Jalankan dengan:
  python backend/migrate_is_active.py
"""
import sys
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path
import os

# Load environment
ROOT_DIR = Path(__file__).parent.parent
env_path = ROOT_DIR / "backend" / ".env"
if env_path.exists():
    load_dotenv(env_path)

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://admin:admin123@localhost:27017/wisasumut?authSource=admin')
DB_NAME = os.environ.get('DB_NAME', 'wisatasumut')


def main():
    print("🚀 Starting migration: add 'is_active' field to destinations and partners")
    print("=" * 60)

    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Migrate destinations
        print("\n📍 Migrating 'destinations' collection...")
        dest_count = db.destinations.count_documents({})
        if dest_count == 0:
            print("  ⚠️  No destinations found. Skipping.")
        else:
            # Set is_active=True for all docs that don't have it
            result_dest = db.destinations.update_many(
                {"is_active": {"$exists": False}},
                {"$set": {"is_active": True}}
            )
            print(f"  ✅ Updated {result_dest.modified_count} destinations")
            
            # Ensure index on is_active
            db.destinations.create_index("is_active")
            print("  🏗️  Created index on 'is_active'")

        # Migrate partners
        print("\n🤝 Migrating 'partners' collection...")
        partner_count = db.partners.count_documents({})
        if partner_count == 0:
            print("  ⚠️  No partners found. Skipping.")
        else:
            result_partner = db.partners.update_many(
                {"is_active": {"$exists": False}},
                {"$set": {"is_active": True}}
            )
            print(f"  ✅ Updated {result_partner.modified_count} partners")
            
            # Ensure index on is_active
            db.partners.create_index("is_active")
            print("  🏗️  Created index on 'is_active'")

        print("\n" + "=" * 60)
        print("✨ Migration completed successfully!")
        print("💡 Next: Restart backend and verify endpoints.")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        sys.exit(1)
    finally:
        if 'client' in locals():
            client.close()
            print("\n🔌 Connection closed")

if __name__ == "__main__":
    main()