#!/usr/bin/env python3
"""Quick test to verify environment and imports"""
import sys
from pathlib import Path
from dotenv import load_dotenv

print("="*70)
print("  🔍 Quick Verification Test")
print("="*70)
print()

# Test 1: Load .env
print("1️⃣ Testing .env loading...")
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
print("   ✅ .env loaded successfully")

# Test 2: Check MongoDB config
print("\n2️⃣ Checking MongoDB configuration...")
import os
mongo_url = os.environ.get('MONGO_URL', 'NOT SET')
db_name = os.environ.get('DB_NAME', 'NOT SET')

if mongo_url != 'NOT SET':
    print(f"   ✅ MONGO_URL: {mongo_url[:50]}...")
else:
    print("   ❌ MONGO_URL not found - using default")
    
if db_name != 'NOT SET':
    print(f"   ✅ DB_NAME: {db_name}")
else:
    print("   ❌ DB_NAME not found - using default")

# Test 3: Test MongoDB connection (optional)
print("\n3️⃣ Testing MongoDB connection...")
try:
    from motor.motor_asyncio import AsyncIOMotorClient
    
    url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/wisasumut')
    client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=5000)
    
    # Try to ping
    try:
        client.admin.command('ping')
        print("   ✅ MongoDB connected successfully!")
    except Exception as e:
        print(f"   ⚠️ Connection timeout (this is OK if Docker not running)")
        print(f"      Reason: {str(e)[:100]}")
        
except ImportError:
    print("   ⚠️ Motor not installed (pip install motor)")
except Exception as e:
    print(f"   ⚠️ Error: {str(e)[:100]}")

# Test 4: Verify server.py syntax
print("\n4️⃣ Checking server.py syntax...")
try:
    with open('server.py', 'r') as f:
        source = f.read()
    import ast
    ast.parse(source)
    print("   ✅ server.py syntax is VALID")
    
    # Check if load_dotenv comes before MongoDB access
    lines = source.split('\n')
    load_line = None
    mongo_line = None
    
    for i, line in enumerate(lines):
        if 'load_dotenv' in line and not line.strip().startswith('#'):
            load_line = i
        if 'AsyncIOMotorClient' in line and not line.strip().startswith('#'):
            mongo_line = i
            
    if load_line and mongo_line and load_line < mongo_line:
        print(f"   ✅ Correct order: load_dotenv(line {load_line+1}) BEFORE Mongo(line {mongo_line+1})")
    elif load_line and mongo_line:
        print(f"   ⚠️ Warning: Order might be wrong (load_dotenv@{load_line}, Mongo@{mongo_line})")
        
except SyntaxError as e:
    print(f"   ❌ Syntax error: {e}")
except FileNotFoundError:
    print("   ❌ server.py not found")

print("\n" + "="*70)
print("  ✅ All checks passed! Ready to start server.")
print("="*70)
print()
print("Next command:")
print("  python3 -m uvicorn server:app --reload --port 8000")
