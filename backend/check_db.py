from database import check_db_connection, engine, SessionLocal
from sqlalchemy import text
import models

def run_diagnostic():
    print("--- Database Diagnostic ---")
    if check_db_connection():
        print("[SUCCESS] Database is reachable.")
        
        # Try to count users
        db = SessionLocal()
        try:
            user_count = db.query(models.User).count()
            print(f"[INFO] Users count: {user_count}")
        except Exception as e:
            print(f"[WARNING] Could not query users table: {e}")
        finally:
            db.close()
    else:
        print("[ERROR] Database is NOT reachable. Check your DATABASE_URL.")

if __name__ == "__main__":
    run_diagnostic()
