# pyrefly: ignore [missing-import]
from sqlalchemy import (
    Boolean, Column, ForeignKey, Integer, String,
    DateTime, JSON, Text, Float, Enum
)
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import relationship
from database import Base
import datetime
import enum


class DeploymentStatus(str, enum.Enum):
    queued = "queued"
    scanning = "scanning"
    analyzing = "analyzing"
    uploading = "uploading"
    building = "building"
    deploying = "deploying"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class DeploymentProvider(str, enum.Enum):
    vercel = "vercel"
    render = "render"
    railway = "railway"
    netlify = "netlify"
    github_pages = "github_pages"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=True)
    hashed_password = Column(String(512), nullable=True)
    github_id = Column(String(128), unique=True, index=True, nullable=True)
    github_username = Column(String(128), nullable=True)
    github_access_token = Column(String(512), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    role = Column(String(50), default="user")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True, nullable=False)
    description = Column(Text, nullable=True)
    framework = Column(String(128), nullable=True)
    project_type = Column(String(64), nullable=True)  # frontend, backend, fullstack
    repository_url = Column(String(512), nullable=True)
    github_repo_name = Column(String(255), nullable=True)
    
    # Build Configuration
    install_command = Column(String(512), nullable=True)
    build_command = Column(String(512), nullable=True)
    output_directory = Column(String(512), nullable=True)
    
    status = Column(String(32), default="uploaded")
  # uploaded, extracting, scanning, ai_analyzing, completed, failed
    ai_analysis = Column(JSON, nullable=True)
    raw_ai_analysis = Column(JSON, nullable=True)
    security_scan = Column(JSON, nullable=True)
    malware_scan = Column(JSON, nullable=True)
    code_review = Column(JSON, nullable=True)
    readiness_score = Column(Float, default=0.0)
    extracted_path = Column(String(512), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="projects")
    deployments = relationship("Deployment", back_populates="project", cascade="all, delete-orphan")
    versions = relationship("Version", back_populates="project", cascade="all, delete-orphan")
    preview_deployments = relationship("PreviewDeployment", back_populates="project", cascade="all, delete-orphan")
    environment_configs = relationship("EnvironmentConfig", back_populates="project", cascade="all, delete-orphan")
    security_scans = relationship("SecurityScan", back_populates="project", cascade="all, delete-orphan")
    ai_reports = relationship("AIReport", back_populates="project", cascade="all, delete-orphan")
    code_reviews = relationship("CodeReview", back_populates="project", cascade="all, delete-orphan")


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    status = Column(String(64), default="queued")
    provider = Column(String(64), nullable=True)
    deployment_url = Column(String(512), nullable=True)
    preview_url = Column(String(512), nullable=True)
    commit_hash = Column(String(128), nullable=True)
    branch = Column(String(128), default="main")
    deploy_mode = Column(String(32), default="production")  # production, preview
    celery_task_id = Column(String(255), nullable=True)
    provider_deployment_id = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    build_duration_seconds = Column(Integer, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="deployments")
    logs = relationship("DeploymentLog", back_populates="deployment", cascade="all, delete-orphan")


class DeploymentLog(Base):
    __tablename__ = "deployment_logs"

    id = Column(Integer, primary_key=True, index=True)
    deployment_id = Column(Integer, ForeignKey("deployments.id"), nullable=False)
    level = Column(String(16), default="info")  # info, warning, error, success
    stage = Column(String(64), nullable=True)
    message = Column(Text, nullable=False)
    raw_output = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    deployment = relationship("Deployment", back_populates="logs")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    event_type = Column(String(128), nullable=False)
    event_category = Column(String(64), nullable=True)  # deployment, security, auth, project
    resource_type = Column(String(64), nullable=True)
    resource_id = Column(Integer, nullable=True)
    description = Column(Text, nullable=False)
    event_metadata = Column(JSON, nullable=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(512), nullable=True)
    severity = Column(String(16), default="info")  # info, warning, critical
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")


class AIReport(Base):
    __tablename__ = "ai_reports"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    report_type = Column(String(64), nullable=False)  # deployment_readiness, build_fix, fix_project
    readiness_score = Column(Float, default=0.0)
    issues = Column(JSON, nullable=True)
    recommendations = Column(JSON, nullable=True)
    summary = Column(Text, nullable=True)
    raw_response = Column(JSON, nullable=True)
    model_used = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="ai_reports")


class CodeReview(Base):
    __tablename__ = "code_reviews"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    total_issues = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    warning_count = Column(Integer, default=0)
    info_count = Column(Integer, default=0)
    security_issues = Column(JSON, nullable=True)
    code_smells = Column(JSON, nullable=True)
    performance_issues = Column(JSON, nullable=True)
    architecture_issues = Column(JSON, nullable=True)
    dependency_issues = Column(JSON, nullable=True)
    overall_quality_score = Column(Float, default=0.0)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="code_reviews")


class SecurityScan(Base):
    __tablename__ = "security_scans"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    scan_status = Column(String(32), default="pending")  # pending, completed, failed
    exposed_secrets = Column(JSON, nullable=True)  # list of {type, file, line, value_preview}
    malware_findings = Column(JSON, nullable=True)
    is_safe = Column(Boolean, default=True)
    risk_level = Column(String(16), default="low")  # low, medium, high, critical
    total_findings = Column(Integer, default=0)
    blocked_deployment = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="security_scans")


class Version(Base):
    __tablename__ = "versions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    version_tag = Column(String(64), nullable=True)
    deployment_id = Column(Integer, ForeignKey("deployments.id"), nullable=True)
    commit_hash = Column(String(128), nullable=True)
    snapshot_path = Column(String(512), nullable=True)
    version_metadata = Column(JSON, nullable=True)
    changelog = Column(Text, nullable=True)
    is_current = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="versions")


class PreviewDeployment(Base):
    __tablename__ = "preview_deployments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    deployment_id = Column(Integer, ForeignKey("deployments.id"), nullable=True)
    preview_url = Column(String(512), nullable=True)
    slug = Column(String(255), unique=True, nullable=True)
    status = Column(String(32), default="active")  # active, expired, deleted
    provider = Column(String(64), nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="preview_deployments")


class EnvironmentConfig(Base):
    __tablename__ = "environment_configs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    key = Column(String(255), nullable=False)
    value = Column(Text, nullable=True)  # Should be encrypted in prod
    is_secret = Column(Boolean, default=False)
    environment = Column(String(32), default="production")  # production, preview, all
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="environment_configs")
