import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

DB_URL = os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL')

if not DB_URL:
    print("❌ Error: DATABASE_URL not found in .env.local")
    print("ℹ️  Please add your connection string to .env.local as DATABASE_URL='postgres://...'")
    exit(1)

def run_migrations():
    print(f"🔌 Connecting to database...")
    
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Get all .sql files in utils/
        utils_dir = 'utils'
        files = [f for f in os.listdir(utils_dir) if f.endswith('.sql')]
        files.sort()
        
        if not files:
            print("⚠️  No .sql files found in utils/")
            return

        print(f"📂 Found {len(files)} SQL files to check.")

        for filename in files:
            filepath = os.path.join(utils_dir, filename)
            print(f"\n📄 Processing {filename}...")
            
            with open(filepath, 'r') as f:
                sql_content = f.read()
                
            try:
                cur.execute(sql_content)
                conn.commit()
                print(f"   ✅ Successfully applied {filename}")
            except Exception as e:
                conn.rollback()
                print(f"   ❌ Error applying {filename}: {e}")
                
        cur.close()
        conn.close()
        print("\n✨ All operations completed.")

    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    run_migrations()
