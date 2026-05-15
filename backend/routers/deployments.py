"""
Deployments Router
IMPORTANT: Static/list routes MUST be declared before parameterised /{id} routes in FastAPI.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
import datetime

import models, auth, database, schemas
from services import audit_service
from services.deployment_service import select_provider_for_framework
from workers.tasks import deploy_project_task
from utils.rate_limiter import rate_limit

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# POST /  — Start a new deployment
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/", status_code=status.HTTP_201_CREATED)
async def start_deployment(
    request: Request,
    body: schemas.DeploymentCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    await rate_limit(request, "deploy", 5, 3600)

    project = db.query(models.Project).filter(
        models.Project.id == body.project_id,
        models.Project.owner_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Security Blocking Rules
    if project.status != "completed":
        reason = f"Project analysis incomplete (status: {project.status})"
        audit_service.log_security_block(db, current_user.id, project.id, reason)
        raise HTTPException(status_code=400, detail=f"Cannot deploy project with status: {project.status}. Wait for analysis to complete.")

    # Idempotency Guard: Prevent multiple active deployments for the same project
    active_deployment = db.query(models.Deployment).filter(
        models.Deployment.project_id == project.id,
        models.Deployment.status.in_(["queued", "preparing", "creating_repository", "pushing_code", "provisioning", "building", "deploying", "verifying"])
    ).first()
    if active_deployment:
        raise HTTPException(status_code=400, detail=f"A deployment is already in progress for this project (ID: {active_deployment.id}).")

    security_scan = db.query(models.SecurityScan).filter(models.SecurityScan.project_id == project.id).order_by(models.SecurityScan.created_at.desc()).first()
    if not security_scan:
        reason = "Security scan results not found"
        audit_service.log_security_block(db, current_user.id, project.id, reason)
        raise HTTPException(status_code=400, detail="Security scan results not found. Please re-analyze the project.")

    if security_scan.blocked_deployment or not security_scan.is_safe:
        reason = "Malware or critical security issues detected"
        audit_service.log_security_block(db, current_user.id, project.id, reason)
        raise HTTPException(status_code=400, detail="Deployment blocked: Malware or critical security issues detected.")
        
    if security_scan.risk_level == "critical":
        reason = "Critical severity secrets exposed"
        audit_service.log_security_block(db, current_user.id, project.id, reason)
        raise HTTPException(status_code=400, detail="Deployment blocked: Critical severity secrets exposed.")

    provider = body.provider or select_provider_for_framework(project.framework or "")

    deployment = models.Deployment(
        project_id=project.id,
        status="queued",
        provider=provider,
        branch=body.branch,
        deploy_mode=body.deploy_mode,
        started_at=datetime.datetime.utcnow(),
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)

    # Dispatch background Celery task (gracefully degrade if Celery/Redis offline)
    extracted_path = project.extracted_path or ""
    task_id = None
    try:
        task = deploy_project_task.delay(
            deployment.id, project.id, extracted_path,
            project.framework or "Unknown", provider,
        )
        deployment.celery_task_id = task.id
        db.commit()
        task_id = task.id
    except Exception as e:
        print(f"[Deployments] Celery unavailable, task not queued: {e}")

    audit_service.log_deployment_started(db, current_user.id, deployment.id, project.name, provider)

    return {
        "deployment_id": deployment.id,
        "status": deployment.status,
        "provider": provider,
        "task_id": task_id,
        "message": "Deployment queued successfully",
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /  — List all deployments for the authenticated user
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/")
def list_all_deployments(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
    skip: int = 0,
    limit: int = 20,
):
    rows = (
        db.query(models.Deployment, models.Project.name.label("project_name"))
        .join(models.Project)
        .filter(models.Project.owner_id == current_user.id)
        .order_by(models.Deployment.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": d.Deployment.id,
            "project_id": d.Deployment.project_id,
            "project_name": d.project_name,
            "status": d.Deployment.status,
            "provider": d.Deployment.provider,
            "deployment_url": d.Deployment.deployment_url,
            "branch": d.Deployment.branch,
            "deploy_mode": d.Deployment.deploy_mode,
            "created_at": d.Deployment.created_at.isoformat(),
        }
        for d in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# GET /project/{project_id}  — Deployments for a specific project
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/project/{project_id}")
def list_project_deployments(
    project_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
    skip: int = 0,
    limit: int = 20,
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    deployments = (
        db.query(models.Deployment)
        .filter(models.Deployment.project_id == project_id)
        .order_by(models.Deployment.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": d.id,
            "status": d.status,
            "provider": d.provider,
            "deployment_url": d.deployment_url,
            "branch": d.branch,
            "deploy_mode": d.deploy_mode,
            "created_at": d.created_at.isoformat(),
        }
        for d in deployments
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Parameterised routes LAST (/{id} must not shadow /project/{id} etc.)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{deployment_id}")
def get_deployment(
    deployment_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    deployment = (
        db.query(models.Deployment)
        .join(models.Project)
        .filter(
            models.Deployment.id == deployment_id,
            models.Project.owner_id == current_user.id,
        )
        .first()
    )
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    logs = (
        db.query(models.DeploymentLog)
        .filter(models.DeploymentLog.deployment_id == deployment_id)
        .order_by(models.DeploymentLog.created_at.asc())
        .all()
    )

    return {
        "id": deployment.id,
        "project_id": deployment.project_id,
        "status": deployment.status,
        "provider": deployment.provider,
        "deployment_url": deployment.deployment_url,
        "branch": deployment.branch,
        "deploy_mode": deployment.deploy_mode,
        "error_message": deployment.error_message,
        "build_duration_seconds": deployment.build_duration_seconds,
        "started_at": deployment.started_at.isoformat() if deployment.started_at else None,
        "completed_at": deployment.completed_at.isoformat() if deployment.completed_at else None,
        "created_at": deployment.created_at.isoformat(),
        "logs": [
            {
                "id": log.id,
                "level": log.level,
                "stage": log.stage,
                "message": log.message,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ],
    }


@router.post("/{deployment_id}/cancel")
def cancel_deployment(
    deployment_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    deployment = (
        db.query(models.Deployment)
        .join(models.Project)
        .filter(
            models.Deployment.id == deployment_id,
            models.Project.owner_id == current_user.id,
        )
        .first()
    )
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    if deployment.status in ("completed", "failed", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel a deployment with status: {deployment.status}",
        )

    if deployment.celery_task_id:
        try:
            from workers.celery_app import celery_app
            celery_app.control.revoke(deployment.celery_task_id, terminate=True)
        except Exception:
            pass

    deployment.status = "cancelled"
    deployment.completed_at = datetime.datetime.utcnow()
    
    # Audit
    audit_service.log_deployment_cancelled(db, current_user.id, deployment.id, project.name, deployment.provider)
    
    db.commit()
    return {"message": "Deployment cancelled", "deployment_id": deployment_id}

@router.post("/{deployment_id}/rollback")
def rollback_deployment(
    deployment_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    """
    Rollback to a specific past deployment.
    This triggers a new deployment task using the commit_hash from the target deployment.
    """
    target = (
        db.query(models.Deployment)
        .join(models.Project)
        .filter(
            models.Deployment.id == deployment_id,
            models.Project.owner_id == current_user.id,
        )
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="Target deployment not found")

    if target.status != "completed":
        raise HTTPException(status_code=400, detail="Can only rollback to a successful deployment")

    project = target.project

    # Create new deployment record
    new_deployment = models.Deployment(
        project_id=project.id,
        provider=target.provider,
        status="queued",
        branch=target.branch,
        commit_hash=target.commit_hash,
        deploy_mode="production",
        started_at=datetime.datetime.utcnow(),
    )
    db.add(new_deployment)
    db.commit()
    db.refresh(new_deployment)

    # Trigger worker task
    from workers.tasks import deploy_project_task
    task = deploy_project_task.delay(
        new_deployment.id,
        project.id,
        project.extracted_path,
        project.framework,
        new_deployment.provider
    )
    new_deployment.celery_task_id = task.id
    db.commit()

    # Audit
    audit_service.log_deployment_started(db, current_user.id, project.id, project.name, new_deployment.provider)

    return {
        "message": "Rollback initiated",
        "deployment_id": new_deployment.id,
        "rollback_to": deployment_id,
        "task_id": task.id
    }


@router.post("/{deployment_id}/retry")
def retry_deployment(
    deployment_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    """
    Retry a failed or cancelled deployment.
    Creates a new deployment record with the same configuration.
    """
    failed_dep = (
        db.query(models.Deployment)
        .join(models.Project)
        .filter(
            models.Deployment.id == deployment_id,
            models.Project.owner_id == current_user.id,
        )
        .first()
    )
    if not failed_dep:
        raise HTTPException(status_code=404, detail="Deployment not found")

    if failed_dep.status not in ("failed", "cancelled"):
        raise HTTPException(status_code=400, detail="Can only retry failed or cancelled deployments")

    project = failed_dep.project

    # Create new deployment record
    new_deployment = models.Deployment(
        project_id=project.id,
        provider=failed_dep.provider,
        status="queued",
        branch=failed_dep.branch,
        commit_hash=failed_dep.commit_hash,
        deploy_mode=failed_dep.deploy_mode,
        started_at=datetime.datetime.utcnow(),
    )
    db.add(new_deployment)
    db.commit()
    db.refresh(new_deployment)

    # Trigger worker task
    from workers.tasks import deploy_project_task
    task = deploy_project_task.delay(
        new_deployment.id,
        project.id,
        project.extracted_path,
        project.framework,
        new_deployment.provider
    )
    new_deployment.celery_task_id = task.id
    db.commit()

    # Audit
    audit_service.log_deployment_started(db, current_user.id, project.id, project.name, new_deployment.provider)

    return {
        "message": "Retry initiated",
        "deployment_id": new_deployment.id,
        "retry_of": deployment_id,
        "task_id": task.id
    }


@router.post("/{deployment_id}/diagnostics")
def get_failure_diagnostics(
    deployment_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    """
    Analyze logs of a failed deployment to suggest a fix.
    """
    deployment = (
        db.query(models.Deployment)
        .join(models.Project)
        .filter(
            models.Deployment.id == deployment_id,
            models.Project.owner_id == current_user.id,
        )
        .first()
    )
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    logs = (
        db.query(models.DeploymentLog)
        .filter(models.DeploymentLog.deployment_id == deployment_id)
        .order_by(models.DeploymentLog.created_at.asc())
        .all()
    )
    
    log_messages = [l.message for l in logs]
    
    from services.diagnostics_service import analyze_deployment_failure
    analysis = analyze_deployment_failure(
        log_messages, 
        deployment.project.framework or "unknown",
        deployment.provider
    )
    
    return analysis


@router.get("/{deployment_id}/logs")
def get_deployment_logs(
    deployment_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    deployment = (
        db.query(models.Deployment)
        .join(models.Project)
        .filter(
            models.Deployment.id == deployment_id,
            models.Project.owner_id == current_user.id,
        )
        .first()
    )
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    logs = (
        db.query(models.DeploymentLog)
        .filter(models.DeploymentLog.deployment_id == deployment_id)
        .order_by(models.DeploymentLog.created_at.asc())
        .all()
    )

    return [
        {
            "id": log.id,
            "level": log.level,
            "stage": log.stage,
            "message": log.message,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]
