from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import requests, os
from datetime import timedelta

import models, auth, database

router = APIRouter()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5173/auth/google/callback")


@router.get("/oauth/url")
def get_google_oauth_url():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Google OAuth not configured")
    
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account"
    }
    url = f"{auth_url}?{'&'.join([f'{k}={v}' for k, v in params.items()])}"
    return {"url": url}


@router.get("/oauth/callback")
def google_oauth_callback(code: str, db: Session = Depends(database.get_db)):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Google OAuth not configured")

    # Exchange code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": GOOGLE_REDIRECT_URI
    }
    
    token_resp = requests.post(token_url, data=token_data)
    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to obtain Google access token")
    
    tokens = token_resp.json()
    access_token = tokens.get("access_token")
    
    # Fetch user info
    user_info_resp = requests.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    if user_info_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch Google user info")
    
    google_user = user_info_resp.json()
    email = google_user.get("email")
    google_id = str(google_user.get("id"))
    full_name = google_user.get("name")
    picture = google_user.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    # Find or create user
    user = db.query(models.User).filter(models.User.email == email).first()
    
    if not user:
        # Create new user
        user = models.User(
            email=email,
            full_name=full_name,
            google_id=google_id,
            avatar_url=picture,
            is_verified=True, # Google emails are verified
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Link google_id if not present
        if not user.google_id:
            user.google_id = google_id
        if not user.avatar_url:
            user.avatar_url = picture
        db.commit()

    # Generate internal tokens
    access_token = auth.create_access_token(data={"sub": user.email})
    refresh_token = auth.create_refresh_token(data={"sub": user.email})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url,
            "role": user.role,
        }
    }
