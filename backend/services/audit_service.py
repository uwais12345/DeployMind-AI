"""
Audit Log Service
Creates structured audit entries for all significant platform events.
"""

import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
import models


def log_event(
    db: Session,
    event_type: str,
    description: str,
    user_id: Optional[int] = None,
    event_category: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
    severity: str = "info",
    ip_address: Optional[str] = None,
) -> models.AuditLog:
    """Create and persist a structured audit log entry."""
    entry = models.AuditLog(
        user_id=user_id,
        event_type=event_type,
        event_category=event_category,
        resource_type=resource_type,
        resource_id=resource_id,
        description=description,
        event_metadata=metadata or {},
        severity=severity,
        ip_address=ip_address,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


# ────────────────────────────────────────────
# Convenience helpers
# ────────────────────────────────────────────

def log_upload(db, user_id, project_id, project_name, framework):
    return log_event(
        db, event_type="project.uploaded",
        description=f"Project '{project_name}' ({framework}) uploaded",
        user_id=user_id, event_category="project",
        resource_type="project", resource_id=project_id,
        metadata={"framework": framework},
    )


def log_deployment_started(db, user_id, deployment_id, project_name, provider):
    return log_event(
        db, event_type="deployment.started",
        description=f"Deployment started for '{project_name}' → {provider}",
        user_id=user_id, event_category="deployment",
        resource_type="deployment", resource_id=deployment_id,
        metadata={"provider": provider}, severity="info",
    )


def log_deployment_completed(db, user_id, deployment_id, project_name, url):
    return log_event(
        db, event_type="deployment.completed",
        description=f"Deployment completed for '{project_name}' at {url}",
        user_id=user_id, event_category="deployment",
        resource_type="deployment", resource_id=deployment_id,
        metadata={"url": url}, severity="info",
    )


def log_deployment_failed(db, user_id, deployment_id, project_name, error):
    return log_event(
        db, event_type="deployment.failed",
        description=f"Deployment failed for '{project_name}': {error[:200]}",
        user_id=user_id, event_category="deployment",
        resource_type="deployment", resource_id=deployment_id,
        metadata={"error": error[:500]}, severity="warning",
    )


def log_security_scan(db, user_id, project_id, risk_level, total_findings):
    severity = "critical" if risk_level == "critical" else "warning" if risk_level == "high" else "info"
    return log_event(
        db, event_type="security.scan_completed",
        description=f"Security scan completed — risk: {risk_level}, findings: {total_findings}",
        user_id=user_id, event_category="security",
        resource_type="project", resource_id=project_id,
        metadata={"risk_level": risk_level, "findings": total_findings},
        severity=severity,
    )


def log_rollback(db, user_id, project_id, version_number):
    return log_event(
        db, event_type="deployment.rollback",
        description=f"Rollback executed to version {version_number}",
        user_id=user_id, event_category="deployment",
        resource_type="project", resource_id=project_id,
        metadata={"version": version_number}, severity="warning",
    )


def log_login(db, user_id, email, ip_address=None):
    return log_event(
        db, event_type="auth.login",
        description=f"User {email} logged in",
        user_id=user_id, event_category="auth",
        resource_type="user", resource_id=user_id,
        ip_address=ip_address,
    )


def log_deployment_cancelled(db, user_id, deployment_id, project_name, provider):
    return log_event(
        db, event_type="deployment.cancelled",
        description=f"Deployment cancelled for '{project_name}'",
        user_id=user_id, event_category="deployment",
        resource_type="deployment", resource_id=deployment_id,
        metadata={"provider": provider}, severity="info",
    )


def log_analysis_completed(db, user_id, project_id, project_name, score):
    return log_event(
        db, event_type="project.analysis_completed",
        description=f"AI analysis completed for '{project_name}' — Score: {score}",
        user_id=user_id, event_category="project",
        resource_type="project", resource_id=project_id,
        metadata={"score": score},
    )


def log_security_block(db, user_id, project_id, reason):
    return log_event(
        db, event_type="security.deployment_blocked",
        description=f"Deployment blocked for project {project_id}: {reason}",
        user_id=user_id, event_category="security",
        resource_type="project", resource_id=project_id,
        metadata={"reason": reason}, severity="critical",
    )

