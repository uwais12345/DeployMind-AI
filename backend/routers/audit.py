from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

import models, auth, database

router = APIRouter()


@router.get("/")
def list_audit_logs(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
    skip: int = 0,
    limit: int = 50,
    category: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
):
    query = db.query(models.AuditLog).filter(models.AuditLog.user_id == current_user.id)

    if category:
        query = query.filter(models.AuditLog.event_category == category)
    if severity:
        query = query.filter(models.AuditLog.severity == severity)
    if event_type:
        query = query.filter(models.AuditLog.event_type.ilike(f"%{event_type}%"))

    total = query.count()
    logs = query.order_by(models.AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "total": total,
        "logs": [
            {
                "id": l.id,
                "event_type": l.event_type,
                "event_category": l.event_category,
                "resource_type": l.resource_type,
                "resource_id": l.resource_id,
                "description": l.description,
                "metadata": l.event_metadata,
                "severity": l.severity,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ],
    }


@router.get("/{log_id}")
def get_audit_log(
    log_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    log = db.query(models.AuditLog).filter(
        models.AuditLog.id == log_id,
        models.AuditLog.user_id == current_user.id,
    ).first()
    if not log:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Log not found")

    return {
        "id": log.id,
        "event_type": log.event_type,
        "event_category": log.event_category,
        "description": log.description,
        "metadata": log.metadata,
        "severity": log.severity,
        "ip_address": log.ip_address,
        "created_at": log.created_at.isoformat(),
    }
