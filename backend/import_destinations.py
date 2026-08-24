"""
Script to import destinations data from JSON to MongoDB
"""
import json
import sys
import re
from pathlib import Path
from datetime import datetime
from bson import ObjectId
from datetime import datetime, timezone
from pymongo import MongoClient

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
env_path = ROOT_DIR / "backend" / ".env"

if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)
    import os
    MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://admin:admin123@localhost:27017/wisasumut?authSource=admin')
else:
    MONGO_URL = 'mongodb://admin:admin123@localhost:27017/wisasumut?authSource=admin'


def parse_json_with_mongodb_types(json_content):
    """Parse JSON content and convert MongoDB-specific syntax to Python objects"""
    
    lines = json_content.split('\n')
    processed_lines = []
    
    for line in lines:
        processed_line = line
        
        # Convert ObjectId("...") to placeholder
        objectid_pattern = r'ObjectId\("([^"]+)"\)'
        matches = re.findall(objectid_pattern, processed_line)
        for match in matches:
            processed_line = processed_line.replace(f'ObjectId("{match}")', f'"__OBJECTID__{match}__"')
        
        # Convert ISODate("...") to placeholder
        isodate_pattern = r'ISODate\("([^"]+)"\)'
        matches = re.findall(isodate_pattern, processed_line)
        for match in matches:
            processed_line = processed_line.replace(f'ISODate("{match}")', f'"__ISODATE__{match}__"')
        
        processed_lines.append(processed_line)
    
    result = '\n'.join(processed_lines)
    result = re.sub(r'"__OBJECTID__([a-fA-F0-9]+)__"', r'"\1"', result)
    result = re.sub(r'"__ISODATE__([^"]+)__"', r'"\1"', result)
    
    return json.loads(result)



def import_destinations():
    """Import destinations from JSON file to MongoDB"""
    
    print("=" * 60)
    print("🌍 DESTINATIONS IMPORTER TO MONGODB")
    print("=" * 60)
    
    try:
        # Connect to MongoDB
        print("\n📡 Connecting to MongoDB...")
        client = MongoClient(MONGO_URL)
        db = client['wisatasumut']
        print("✅ Connected successfully!")
        
        # Read JSON file
        json_file = Path('../docs/destinations.json')
        if not json_file.exists():
            print(f"❌ Error: File not found - {json_file}")
            sys.exit(1)
        
        print(f"\n📄 Reading file: {json_file}")
        with open(json_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Parse JSON
        print("\n🔄 Parsing JSON data...")
        destinations = parse_json_with_mongodb_types(content)
        print(f"✅ Parsed {len(destinations)} destinations")
        
        # Clear existing data
        print("\n🧹 Clearing existing destinations collection...")
        db.destinations.delete_many({})
        print("✅ Collection cleared")
        
        # Prepare documents
        print("\n📝 Preparing documents for insertion...")
        documents = []
        for dest in destinations:
            doc = {
                'name': dest['name'],
                'name_en': dest['name_en'],
                'location': dest['location'],
                'category': dest['category'],
                'price': dest['price'],
                'description': dest['description'],
                'description_en': dest['description_en'],
                'tags': dest.get('tags', []),
                'source_label': dest.get('source_label', 'Instagram @explorewisatasumut'),
                'source_url': dest.get('source_url', 'https://www.instagram.com/explorewisatasumut/'),
                'editorial_reviewed_at': dest.get('editorial_reviewed_at', dest['created_at']),
                'editorial_status': dest.get('editorial_status', 'published'),
                'images': dest.get('images', []),
                'video': dest.get('video', ''),
                'latitude': dest['latitude'],
                'longitude': dest['longitude'],
                'featured': dest.get('featured', False),
                'is_active': dest.get('is_active', True),
                'created_at': dest['created_at']
            }
            documents.append(doc)
        
        # Insert documents
        print(f"\n💾 Inserting {len(documents)} documents...")
        result = db.destinations.insert_many(documents)
        print(f"✅ Successfully inserted {len(result.inserted_ids)} documents")
        
        # Create indexes
        print("\n🏗️  Creating indexes...")
        db.destinations.create_index('category')
        print("  ✓ Created index on 'category'")
        
        db.destinations.create_index('featured')
        print("  ✓ Created index on 'featured'")
        
        db.destinations.create_index([('latitude', 1), ('longitude', 1)])
        print("  ✓ Created compound index on location")
        
        db.destinations.create_index([
            ('name', 'text'),
            ('description', 'text'),
            ('location', 'text')
        ])
        print("  ✓ Created text search index")
        
        # Verify import
        print("\n✅ VERIFICATION:")
        total = db.destinations.count_documents({})
        featured = db.destinations.count_documents({'featured': True})
        categories = list(db.destinations.aggregate([
            {'$group': {'_id': '$category', 'count': {'$sum': 1}}}
        ]))
        
        print(f"  📊 Total destinations: {total}")
        print(f"  ⭐ Featured: {featured}")
        print("  📁 Categories:")
        for cat in categories:
            print(f"     • {cat['_id']}: {cat['count']}")
        
        print("\n" + "=" * 60)
        print("✨ IMPORT COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        if 'client' in locals():
            client.close()
            print("\n🔌 Connection closed")


if __name__ == "__main__":
    success = import_destinations()
    sys.exit(0 if success else 1)
