#!/usr/bin/env python3
"""
Script untuk seeding admin user pertama kali
Bisa digunakan di lokal atau production
"""
import sys
sys.path.insert(0, '/home/prasdios/aiproject/ews/backend')

from dotenv import load_dotenv
load_dotenv('/home/prasdios/aiproject/ews/backend/.env')

import bcrypt
from pymongo import MongoClient
from bson.objectid import ObjectId
import os

# Environment setup
MONGO_URI = os.environ.get('MONGO_URL', '')
DB_NAME = os.environ.get('DB_NAME', 'wisatasumut')
JWT_SECRET = os.environ.get('JWT_SECRET', '')

print("=" * 70)
print("🔐 SEED ADMIN USER SCRIPT")
print("=" * 70)
print(f"\nMongoDB URI: {MONGO_URI.split('@')[0]}@...")
print(f"Database: {DB_NAME}")
print(f"JWT Secret Length: {len(JWT_SECRET)} chars")

if not JWT_SECRET or JWT_SECRET == "replace-with-a-long-random-secret":
    print("\n❌ ERROR: JWT_SECRET must be set!")
    print("   Local: JWT_SECRET=your-super-secret-key-change-in-production-12345")
    print("   Prod:  EZVRBn1AcmwN2TIcpBs5SO1WHFuT7CbNiqk5uDokn9s")
    sys.exit(1)

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client[DB_NAME]
users_collection = db['users']

# Check if admin already exists
existing_admin = users_collection.find_one({"email": "admin@ews.planner"})
if existing_admin:
    print(f"\n✅ Admin user already exists: {existing_admin['email']}")
    print(f"   ID: {existing_admin['_id']}")
    print(f"   Role: {existing_admin.get('role', 'user')}")
    client.close()
    sys.exit(0)

print("\n🎯 Creating initial admin user...")
print("-" * 70)

# Default admin credentials
DEFAULT_ADMIN_EMAIL = "admin@ews.planner"
DEFAULT_ADMIN_PASSWORD = "admin123"  # Change this after first login!
DEFAULT_ADMIN_NAME = "Administrator"

# Hash password using bcrypt (same as in server.py)
password_hash = bcrypt.hashpw(
    DEFAULT_ADMIN_PASSWORD.encode('utf-8'), 
    bcrypt.gensalt(rounds=12)
).decode('utf-8')

# Create admin document
admin_user = {
    "email": DEFAULT_ADMIN_EMAIL,
    "password_hash": password_hash,
    "name": DEFAULT_ADMIN_NAME,
    "role": "admin",
    "account_active": True,
    "is_verified": True,
    "created_at": "now",  # Will be set properly
    "updated_at": "now",
    "login_count": 0,
    "last_login": None,
}

try:
    # Insert admin user
    result = users_collection.insert_one(admin_user)
    
    print(f"\n✅ SUCCESS! Admin user created!")
    print("-" * 70)
    print(f"\n📋 Admin Credentials:")
    print(f"   Email:    {DEFAULT_ADMIN_EMAIL}")
    print(f"   Password: {DEFAULT_ADMIN_PASSWORD}")
    print(f"\n⚠️  IMPORTANT: Change password after first login!")
    print("-" * 70)
    
    # Verify creation
    verified_admin = users_collection.find_one({"_id": result.inserted_id})
    if verified_admin:
        print(f"\n🔍 Verification:")
        print(f"   ID:         {verified_admin['_id']}")
        print(f"   Email:      {verified_admin['email']}")
        print(f"   Role:       {verified_admin['role']}")
        print(f"   Active:     {verified_admin['account_active']}")
        print(f"   Verified:   {verified_admin['is_verified']}")
    
except Exception as e:
    print(f"\n❌ ERROR creating admin user: {e}")
    client.close()
    sys.exit(1)

client.close()
print(f"\n{'='*70}\n")
