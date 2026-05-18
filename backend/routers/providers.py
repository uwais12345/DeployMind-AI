"""
Providers Router — Cloud credential management with health monitoring and audit trails.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
from pydantic import BaseModel
import requests
import datetime

import models, auth, database
from utils.encryption import encrypt_value, decrypt_value
from services import audit_service

router = APIRouter()


class ProviderCredentialCreate(BaseModel):
    provider: str
    token: str

class ProviderCredentialUpdate(BaseModel):
    token: str

class TestConnectionRequest(BaseModel):
    provider: str
    token: str


def _compute_health_status(cred: models.ProviderCredential, fail_streak: int) -> str:
    """Derive a human-readable health status from credential metadata."""
    if not cred.is_active:
        return "disconnected"
    if fail_streak >= 3:
        return "degraded"
    if fail_streak >= 1:
        return "warning"
    return "healthy"


@router.get("/credentials", response_model=List[Dict[str, Any]])
def get_credentials(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    credentials = db.query(models.ProviderCredential).filter(
        models.ProviderCredential.user_id == current_user.id
    ).all()

    # Get deployment stats per provider for this user's projects
    project_ids = [p.id for p in db.query(models.Project.id).filter(models.Project.owner_id == current_user.id).all()]
    provider_stats: Dict[str, Dict] = {}
    if project_ids:
        deployments = db.query(models.Deployment).filter(
            models.Deployment.project_id.in_(project_ids)
        ).all()
        for d in deployments:
            p = d.provider or "unknown"
            if p not in provider_stats:
                provider_stats[p] = {"total": 0, "success": 0, "failed": 0, "last_success": None}
            provider_stats[p]["total"] += 1
            if d.status == "completed":
                provider_stats[p]["success"] += 1
                if not provider_stats[p]["last_success"] or d.completed_at and d.completed_at > provider_stats[p]["last_success"]:
                    provider_stats[p]["last_success"] = d.completed_at
            elif d.status == "failed":
                provider_stats[p]["failed"] += 1

    result = []
    for cred in credentials:
        decrypted = decrypt_value(cred.encrypted_token)
        masked_token = f"{decrypted[:4]}****{decrypted[-4:]}" if len(decrypted) > 8 else "****"
        if cred.provider == "render":
            masked_token = f"rnd_****{decrypted[-4:]}" if len(decrypted) > 8 else "****"

        stats = provider_stats.get(cred.provider, {})
        fail_streak = stats.get("failed", 0)  # simplified - could be tracked in model
        health = _compute_health_status(cred, fail_streak)

        last_success = stats.get("last_success")
        result.append({
            "provider": cred.provider,
            "configured": True,
            "masked_token": masked_token,
            "last_used_at": cred.last_used_at.isoformat() if cred.last_used_at else None,
            "created_at": cred.created_at.isoformat() if cred.created_at else None,
            "health": health,
            "total_deployments": stats.get("total", 0),
            "successful_deployments": stats.get("success", 0),
            "failed_deployments": fail_streak,
            "last_successful_deployment": last_success.isoformat() if last_success else None,
            "success_rate": round(stats.get("success", 0) / stats.get("total", 1) * 100) if stats.get("total") else None,
        })
    return result


@router.post("/credentials")
def create_credential(
    req: ProviderCredentialCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    existing = db.query(models.ProviderCredential).filter(
        models.ProviderCredential.user_id == current_user.id,
        models.ProviderCredential.provider == req.provider
    ).first()

    is_update = bool(existing)

    if existing:
        existing.encrypted_token = encrypt_value(req.token)
        existing.is_active = True
        existing.updated_at = datetime.datetime.utcnow()
    else:
        cred = models.ProviderCredential(
            user_id=current_user.id,
            provider=req.provider,
            encrypted_token=encrypt_value(req.token),
            is_active=True
        )
        db.add(cred)

    db.commit()

    # Audit
    if is_update:
        audit_service.log_provider_updated(db, current_user.id, req.provider)
    else:
        audit_service.log_provider_connected(db, current_user.id, req.provider)

    return {"success": True, "message": f"{req.provider} credentials saved"}


@router.put("/credentials/{provider}")
def update_credential(
    provider: str,
    req: ProviderCredentialUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    cred = db.query(models.ProviderCredential).filter(
        models.ProviderCredential.user_id == current_user.id,
        models.ProviderCredential.provider == provider
    ).first()

    if not cred:
        raise HTTPException(status_code=404, detail="Provider credentials not found")

    cred.encrypted_token = encrypt_value(req.token)
    cred.is_active = True
    cred.updated_at = datetime.datetime.utcnow()
    db.commit()

    audit_service.log_provider_updated(db, current_user.id, provider)
    return {"success": True, "message": f"{provider} credentials updated"}


@router.delete("/credentials/{provider}")
def delete_credential(
    provider: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    cred = db.query(models.ProviderCredential).filter(
        models.ProviderCredential.user_id == current_user.id,
        models.ProviderCredential.provider == provider
    ).first()

    if not cred:
        raise HTTPException(status_code=404, detail="Provider credentials not found")

    db.delete(cred)
    db.commit()

    audit_service.log_provider_disconnected(db, current_user.id, provider)
    return {"success": True, "message": f"{provider} credentials removed"}


@router.post("/test-connection")
def test_connection(
    req: TestConnectionRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    provider = req.provider.lower()
    token = req.token

    try:
        if provider == "render":
            resp = requests.get(
                "https://api.render.com/v1/services",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                params={"limit": 1}, timeout=8
            )
            if resp.status_code in (200, 201):
                return {"success": True, "message": "Connected to Render successfully"}
            elif resp.status_code == 401:
                audit_service.log_provider_validation_failed(db, current_user.id, provider, "Invalid or expired token")
                return {"success": False, "error": "Your Render API token is invalid or has expired. Generate a new token from the Render dashboard."}
            elif resp.status_code == 429:
                return {"success": False, "error": "Render API rate limit reached. Please wait a moment and try again."}
            else:
                audit_service.log_provider_validation_failed(db, current_user.id, provider, f"HTTP {resp.status_code}")
                return {"success": False, "error": f"Render returned an unexpected response (HTTP {resp.status_code}). Check your token permissions."}

        elif provider == "vercel":
            resp = requests.get(
                "https://api.vercel.com/v2/user",
                headers={"Authorization": f"Bearer {token}"}, timeout=8
            )
            if resp.status_code in (200, 201):
                return {"success": True, "message": "Connected to Vercel successfully"}
            elif resp.status_code == 401:
                audit_service.log_provider_validation_failed(db, current_user.id, provider, "Invalid or expired token")
                return {"success": False, "error": "Your Vercel API token is invalid or has expired. Generate a new token from the Vercel account settings."}
            elif resp.status_code == 403:
                return {"success": False, "error": "Access denied. Your Vercel token may lack the required permissions."}
            else:
                audit_service.log_provider_validation_failed(db, current_user.id, provider, f"HTTP {resp.status_code}")
                return {"success": False, "error": f"Vercel returned an unexpected response (HTTP {resp.status_code})."}

        elif provider == "railway":
            # Railway uses GraphQL — simulate with introspection ping
            resp = requests.post(
                "https://backboard.railway.app/graphql/v2",
                json={"query": "{ me { id email } }"},
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                timeout=8
            )
            if resp.status_code == 200 and "errors" not in resp.json():
                return {"success": True, "message": "Connected to Railway successfully"}
            elif resp.status_code == 401 or (resp.status_code == 200 and "errors" in resp.json()):
                audit_service.log_provider_validation_failed(db, current_user.id, provider, "Invalid token")
                return {"success": False, "error": "Your Railway API token is invalid. Generate a new one from Railway account settings."}
            else:
                return {"success": False, "error": f"Railway returned an unexpected response (HTTP {resp.status_code})."}

        elif provider == "netlify":
            resp = requests.get(
                "https://api.netlify.com/api/v1/user",
                headers={"Authorization": f"Bearer {token}"}, timeout=8
            )
            if resp.status_code == 200:
                return {"success": True, "message": "Connected to Netlify successfully"}
            elif resp.status_code == 401:
                audit_service.log_provider_validation_failed(db, current_user.id, provider, "Invalid token")
                return {"success": False, "error": "Your Netlify personal access token is invalid or expired. Generate a new one from Netlify user settings."}
            else:
                audit_service.log_provider_validation_failed(db, current_user.id, provider, f"HTTP {resp.status_code}")
                return {"success": False, "error": f"Netlify returned an unexpected response (HTTP {resp.status_code})."}

        else:
            raise HTTPException(status_code=400, detail="Unsupported provider")

    except requests.Timeout:
        audit_service.log_provider_validation_failed(db, current_user.id, provider, "Connection timed out")
        return {"success": False, "error": f"Could not reach {provider}. The provider may be temporarily unreachable. Please try again."}
    except requests.RequestException as e:
        audit_service.log_provider_validation_failed(db, current_user.id, provider, str(e))
        return {"success": False, "error": f"A network error occurred while connecting to {provider}. Check your internet connection and try again."}
