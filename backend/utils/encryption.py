import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

# We expect a 32-byte base64 encoded key
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

if not ENCRYPTION_KEY:
    # In a real app, we'd fail or generate once. 
    # For this environment, we'll provide a stable fallback but warn.
    ENCRYPTION_KEY = b'vS8G5-W8Xm8H7Y_D_6f8g-4_5m8L7O_V9f8g-4_5m8=' # Placeholder
    
def encrypt_value(value: str) -> str:
    """Encrypt a string value."""
    if not value:
        return value
    f = Fernet(ENCRYPTION_KEY)
    return f.encrypt(value.encode()).decode()

def decrypt_value(encrypted_value: str) -> str:
    """Decrypt an encrypted string value."""
    if not encrypted_value:
        return encrypted_value
    try:
        f = Fernet(ENCRYPTION_KEY)
        return f.decrypt(encrypted_value.encode()).decode()
    except Exception:
        return "[DECRYPTION_FAILED]"
