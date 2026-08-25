#!/usr/bin/env python3
"""
Migration script to import destinations.json to MongoDB Atlas
Converts MongoDB-specific syntax and bulk inserts data
"""
import json
import re
from pymongo import MongoClient, ASCENDING, DESCENDING

def clean_mongodb_syntax(json_string):
    """Clean MongoDB-specific syntax from JSON string"""
    line = re.sub(r'ObjectId\(["\']([^"\']+)["\']\)', r'"\1"', json_string)
    line = re.sub(r'ISODate\(["\']([^"\']+)["\']\)', r'"\1"', line)
    return line

def main():
    print("=" * 70)
    print("🚀 DESTINATIONS MIGRATION TO MONGODB ATLAS")
    print("=" * 70)
    
    # Configuration
    MONGO_URI = "mongodb+srv://admin_ews:v5Z8zzxIdmcDAr9f@ewsplanner.kgpepmb.mongodb.net/?appName=EwsPlanner"
    DB_NAME = "wisatasumut"
    INPUT_FILE = "dataews/import/destinations.json"
    
    # Step 1: Clean the input file first
    print("\n📝 Cleaning source file...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    cleaned_content = clean_mongodb_syntax(content)
    items_str = cleaned_content.strip().strip('[]')
    items = [item.strip() for item in items_str.split('},')]
    
    cleaned_items = []
    for i, item in enumerate(items):
        if not item.startswith('{'):
            item = '{' + item
        if not item.endswith('}'):
            item = item + '}'
        try:
            dest = json.loads(item)
            cleaned_items.append(dest)
            print(f"✓ {i+1}/{len(items)}: {dest.get('name', 'Unknown')[:40]}")
        except Exception as e:
            print(f"✗ Error: {e}")
    
    print(f"\n✅ Cleaned {len(cleaned_items)} destinations")
    
    # Step 2: Connect to MongoDB
    print("\n📡 Connecting to MongoDB Atlas...")
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.server_info()
    db = client[DB_NAME]
    print(f"✅ Connected to database: {DB_NAME}")
    
    # Step 3: Clear existing data
    print("\n🔍 Clearing existing data...")
    collection = db['destinations']
    existing_count = collection.count_documents({})
    if existing_count > 0:
        print(f"⚠️ Deleting {existing_count} existing documents...")
        collection.delete_many({})
        print("✓ Cleared")
    else:
        print("✓ Collection was empty")
    
    # Step 4: Insert new data
    print("\n💾 Inserting destinations...")
    result = collection.insert_many(cleaned_items, ordered=False)
    print(f"✅ Inserted {result.inserted_count} documents")
    
    # Step 5: Create indexes
    print("\n🏗️ Creating indexes...")
    collection.create_index([('category', ASCENDING)])
    print("✓ Category index")
    collection.create_index([('location', 'text')])
    print("✓ Location text index")
    collection.create_index([('featured', DESCENDING)])
    print("✓ Featured index")
    collection.create_index([('latitude', ASCENDING), ('longitude', ASCENDING)])
    print("✓ Coordinates index")
    collection.create_index([('created_at', DESCENDING)])
    print("✓ Created date index")
    print(f"✅ 5 indexes created")
    
    # Final verification
    total = collection.count_documents({})
    featured = collection.count_documents({'featured': True})
    categories = sorted(collection.distinct('category'))
    
    print(f"\n{'='*70}")
    print("📊 MIGRATION SUMMARY")
    print(f"{'='*70}")
    print(f"Total destinations imported: {total}")
    print(f"Featured destinations:       {featured}")
    print(f"Categories:                  {', '.join(categories)}")
    print(f"{'='*70}\n")
    
    client.close()
    print("✅ Migration completed successfully!")

if __name__ == '__main__':
    main()
