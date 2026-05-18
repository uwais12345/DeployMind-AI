from database import engine, Base
from sqlalchemy import text
import models

def update_schema():
    print("Updating database schema...")
    
    # 1. Add missing google_id column to users table
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(128);"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id ON users (google_id);"))
        print("[SUCCESS] Added google_id column to users table.")
    except Exception as e:
        print(f"[ERROR] Failed to alter users table: {e}")

    # 2. Create any missing tables (e.g., audit_logs)
    try:
        Base.metadata.create_all(bind=engine)
        print("[SUCCESS] Created missing tables (if any).")
    except Exception as e:
        print(f"[ERROR] Failed to create tables: {e}")

if __name__ == "__main__":
    update_schema()
