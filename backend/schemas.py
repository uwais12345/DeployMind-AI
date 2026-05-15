from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any, Dict
from datetime import datetime


# ────────────────────────────────────────────
# AUTH / USER SCHEMAS
# ────────────────────────────────────────────

class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str
    full_name: Optional[str] = None


class UserLogin(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(UserBase):
    id: int
    full_name: Optional[str] = None
    github_username: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    is_verified: bool
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[UserResponse] = None


class TokenData(BaseModel):
    email: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ────────────────────────────────────────────
# PROJECT SCHEMAS
# ────────────────────────────────────────────

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    framework: Optional[str] = None
    project_type: Optional[str] = None
    repository_url: Optional[str] = None
    github_repo_name: Optional[str] = None
    readiness_score: float
    ai_analysis: Optional[Dict[str, Any]] = None
    security_scan: Optional[Dict[str, Any]] = None
    owner_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectList(BaseModel):
    projects: List[ProjectResponse]
    total: int


# ────────────────────────────────────────────
# DEPLOYMENT SCHEMAS
# ────────────────────────────────────────────

class DeploymentCreate(BaseModel):
    project_id: int
    provider: str
    deploy_mode: Optional[str] = "production"
    branch: Optional[str] = "main"


class DeploymentResponse(BaseModel):
    id: int
    project_id: int
    status: str
    provider: Optional[str] = None
    deployment_url: Optional[str] = None
    preview_url: Optional[str] = None
    commit_hash: Optional[str] = None
    branch: str
    deploy_mode: str
    celery_task_id: Optional[str] = None
    error_message: Optional[str] = None
    build_duration_seconds: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DeploymentLogResponse(BaseModel):
    id: int
    deployment_id: int
    level: str
    stage: Optional[str] = None
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


# ────────────────────────────────────────────
# AUDIT LOG SCHEMAS
# ────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    event_type: str
    event_category: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    description: str
    metadata: Optional[Dict[str, Any]] = None
    severity: str
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogList(BaseModel):
    logs: List[AuditLogResponse]
    total: int


# ────────────────────────────────────────────
# AI REPORT SCHEMAS
# ────────────────────────────────────────────

class AIReportResponse(BaseModel):
    id: int
    project_id: int
    report_type: str
    readiness_score: float
    issues: Optional[List[Any]] = None
    recommendations: Optional[List[Any]] = None
    summary: Optional[str] = None
    model_used: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ────────────────────────────────────────────
# CODE REVIEW SCHEMAS
# ────────────────────────────────────────────

class CodeReviewResponse(BaseModel):
    id: int
    project_id: int
    total_issues: int
    critical_count: int
    warning_count: int
    info_count: int
    security_issues: Optional[List[Any]] = None
    code_smells: Optional[List[Any]] = None
    performance_issues: Optional[List[Any]] = None
    architecture_issues: Optional[List[Any]] = None
    dependency_issues: Optional[List[Any]] = None
    overall_quality_score: float
    summary: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ────────────────────────────────────────────
# SECURITY SCAN SCHEMAS
# ────────────────────────────────────────────

class SecurityScanResponse(BaseModel):
    id: int
    project_id: int
    scan_status: str
    exposed_secrets: Optional[List[Any]] = None
    malware_findings: Optional[List[Any]] = None
    is_safe: bool
    risk_level: str
    total_findings: int
    blocked_deployment: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ────────────────────────────────────────────
# VERSION SCHEMAS
# ────────────────────────────────────────────

class VersionResponse(BaseModel):
    id: int
    project_id: int
    version_number: int
    version_tag: Optional[str] = None
    deployment_id: Optional[int] = None
    commit_hash: Optional[str] = None
    changelog: Optional[str] = None
    is_current: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RollbackRequest(BaseModel):
    version_id: int


# ────────────────────────────────────────────
# PREVIEW DEPLOYMENT SCHEMAS
# ────────────────────────────────────────────

class PreviewDeploymentResponse(BaseModel):
    id: int
    project_id: int
    deployment_id: Optional[int] = None
    preview_url: Optional[str] = None
    slug: Optional[str] = None
    status: str
    provider: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ────────────────────────────────────────────
# ENVIRONMENT CONFIG SCHEMAS
# ────────────────────────────────────────────

class EnvVarCreate(BaseModel):
    key: str
    value: str
    is_secret: bool = False
    environment: str = "production"


class EnvVarResponse(BaseModel):
    id: int
    project_id: int
    key: str
    value: Optional[str] = None
    is_secret: bool
    environment: str
    created_at: datetime

    class Config:
        from_attributes = True


# ────────────────────────────────────────────
# UPLOAD RESPONSE
# ────────────────────────────────────────────

class UploadAnalysisResponse(BaseModel):
    message: str
    project_id: int
    framework: str
    project_type: str
    analysis: Dict[str, Any]
    security_scan: Dict[str, Any]
    malware_scan: Dict[str, Any]
    code_review: Dict[str, Any]
    readiness_score: float
    task_id: Optional[str] = None


# ────────────────────────────────────────────
# GENERIC RESPONSES
# ────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
