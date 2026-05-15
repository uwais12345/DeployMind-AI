import time
from fastapi import HTTPException, Request
from database import redis_client

async def rate_limit(request: Request, key_prefix: str, limit: int, window: int):
    """
    Simple rate limiter using Redis.
    - key_prefix: type of action (e.g., 'upload', 'deploy')
    - limit: max requests
    - window: time window in seconds
    """
    if not redis_client:
        return # Skip if redis is not available
        
    client_ip = request.client.host
    key = f"rate_limit:{key_prefix}:{client_ip}"
    
    current = redis_client.get(key)
    if current and int(current) >= limit:
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")
    
    if not current:
        redis_client.setex(key, window, 1)
    else:
        redis_client.incr(key)
