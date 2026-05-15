from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import datetime

import models, auth, database
from services import audit_service

router = APIRouter()


@router.get("/project/{project_id}")
def list_versions(
    project_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    versions = (
        db.query(models.Version)
        .filter(models.Version.project_id == project_id)
        .order_by(models.Version.version_number.desc())
        .all()
    )

    return [
        {
            "id": v.id,
            "version_number": v.version_number,
            "version_tag": v.version_tag,
            "deployment_id": v.deployment_id,
            "commit_hash": v.commit_hash,
            "changelog": v.changelog,
            "is_current": v.is_current,
            "created_at": v.created_at.isoformat(),
        }
        for v in versions
    ]


@router.post("/project/{project_id}/rollback/{version_id}")
def rollback_to_version(
    project_id: int,
    version_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    version = db.query(models.Version).filter(
        models.Version.id == version_id,
        models.Version.project_id == project_id,
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Mark all versions as not current
    db.query(models.Version).filter(
        models.Version.project_id == project_id
    ).update({"is_current": False})

    # Mark target version as current
    version.is_current = True
    db.commit()

    # Log rollback
    audit_service.log_rollback(db, current_user.id, project_id, version.version_number)

    return {
        "message": f"Rolled back to version {version.version_number}",
        "version_id": version_id,
        "version_number": version.version_number,
    }
