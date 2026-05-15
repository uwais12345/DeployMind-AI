from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import datetime, uuid

import models, auth, database

router = APIRouter()


@router.get("/project/{project_id}")
def list_previews(
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

    previews = (
        db.query(models.PreviewDeployment)
        .filter(models.PreviewDeployment.project_id == project_id)
        .order_by(models.PreviewDeployment.created_at.desc())
        .all()
    )

    return [
        {
            "id": p.id,
            "preview_url": p.preview_url,
            "slug": p.slug,
            "status": p.status,
            "provider": p.provider,
            "expires_at": p.expires_at.isoformat() if p.expires_at else None,
            "created_at": p.created_at.isoformat(),
        }
        for p in previews
    ]


@router.post("/project/{project_id}")
def create_preview(
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

    slug = f"{project.name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:8]}"
    preview_url = f"https://preview.deploymind.app/{slug}"
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=7)

    preview = models.PreviewDeployment(
        project_id=project_id,
        preview_url=preview_url,
        slug=slug,
        status="active",
        provider="deploymind",
        expires_at=expires_at,
    )
    db.add(preview)
    db.commit()
    db.refresh(preview)

    return {
        "id": preview.id,
        "preview_url": preview.preview_url,
        "slug": preview.slug,
        "status": preview.status,
        "expires_at": preview.expires_at.isoformat(),
        "created_at": preview.created_at.isoformat(),
    }


@router.delete("/{preview_id}")
def delete_preview(
    preview_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    preview = (
        db.query(models.PreviewDeployment)
        .join(models.Project)
        .filter(
            models.PreviewDeployment.id == preview_id,
            models.Project.owner_id == current_user.id,
        )
        .first()
    )
    if not preview:
        raise HTTPException(status_code=404, detail="Preview not found")

    preview.status = "deleted"
    db.commit()
    return {"message": "Preview deleted"}
