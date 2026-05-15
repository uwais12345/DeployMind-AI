# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Request
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from typing import Tuple
import os, shutil, zipfile, tempfile, uuid, datetime, json, asyncio

import models, auth, database, schemas
from services.ai_service import analyze_build_errors, fix_my_project
from services.security_scanner import scan_project_for_secrets
from services.malware_detector import scan_project_for_malware
from services import audit_service
from workers.tasks import deploy_project_task, analyze_project_task
from utils.rate_limiter import rate_limit

router = APIRouter()

UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "deploymind_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


def extract_zip_safe(zip_path: str, extract_path: str):
    """Extract ZIP file synchronously but safely (called via to_thread)."""
    with zipfile.ZipFile(zip_path, "r") as zf:
        for member in zf.namelist():
            if member.startswith("/") or ".." in member:
                raise ValueError("Invalid zip structure (zip slip detected)")
        zf.extractall(extract_path)


def detect_project_type(extracted_dir: str) -> Tuple[str, str]:
    """Returns (framework, project_type) where type = frontend|backend|fullstack|static."""
    files = os.listdir(extracted_dir)

    has_package_json = "package.json" in files
    has_requirements = "requirements.txt" in files
    has_pyproject = "pyproject.toml" in files
    has_manage_py = "manage.py" in files

    framework = None
    project_type = None

    if has_package_json:
        try:
            with open(os.path.join(extracted_dir, "package.json"), "r", encoding="utf-8") as f:
                pkg = json.load(f)
                deps = pkg.get("dependencies", {})
                dev_deps = pkg.get("devDependencies", {})
                all_deps = {**deps, **dev_deps}
                
                if "next" in all_deps:
                    framework, project_type = "Next.js", "fullstack"
                elif "nuxt" in all_deps:
                    framework, project_type = "Nuxt", "fullstack"
                elif "@remix-run/react" in all_deps:
                    framework, project_type = "Remix", "fullstack"
                elif "@sveltejs/kit" in all_deps:
                    framework, project_type = "SvelteKit", "fullstack"
                elif "astro" in all_deps:
                    framework, project_type = "Astro", "fullstack"
                elif "@nestjs/core" in all_deps:
                    framework, project_type = "NestJS", "backend"
                elif "express" in all_deps:
                    framework, project_type = "Express.js", "backend"
                elif "vue" in all_deps:
                    framework, project_type = "Vue", "frontend"
                elif "@angular/core" in all_deps:
                    framework, project_type = "Angular", "frontend"
                elif "react" in all_deps:
                    framework = "Vite/React" if "vite" in all_deps else "React"
                    project_type = "frontend"
                else:
                    framework, project_type = "Node.js", "backend"
        except Exception:
            framework, project_type = "Node.js", "backend"

    if has_requirements or has_pyproject or has_manage_py:
        if not framework:
            framework = "Python"
            project_type = "backend"
        else:
            project_type = "fullstack"

        try:
            req_content = ""
            if has_requirements:
                req_content = open(os.path.join(extracted_dir, "requirements.txt"), encoding="utf-8").read().lower()
            elif has_pyproject:
                req_content = open(os.path.join(extracted_dir, "pyproject.toml"), encoding="utf-8").read().lower()
            
            if "fastapi" in req_content:
                framework = "FastAPI"
            elif "django" in req_content or has_manage_py:
                framework = "Django"
            elif "flask" in req_content:
                framework = "Flask"
        except Exception:
            pass

    if not framework:
        if "index.html" in files:
            framework, project_type = "Static HTML", "static"
        else:
            raise HTTPException(status_code=400, detail="Unsupported project structure. Could not detect any known framework.")

    return framework, project_type


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_project(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    await rate_limit(request, "upload", 10, 3600)

    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are allowed")

    upload_id = str(uuid.uuid4())
    zip_path = os.path.join(UPLOAD_DIR, f"{upload_id}.zip")
    extract_path = os.path.join(UPLOAD_DIR, upload_id)

    success = False
    try:
        # Save ZIP with size check
        total_size = 0
        with open(zip_path, "wb") as buffer:
            chunk = await file.read(1024 * 1024)
            while chunk:
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(status_code=400, detail="File too large. Maximum 100MB allowed.")
                buffer.write(chunk)
                chunk = await file.read(1024 * 1024)

        # Extract safely in a thread to avoid blocking event loop
        await asyncio.to_thread(extract_zip_safe, zip_path, extract_path)

        # Find project root
        extracted_files = os.listdir(extract_path)
        root_dir = extract_path
        if len(extracted_files) == 1 and os.path.isdir(os.path.join(extract_path, extracted_files[0])):
            root_dir = os.path.join(extract_path, extracted_files[0])

        # Detect framework
        framework, project_type = detect_project_type(root_dir)

        # Create project with status 'uploaded'
        project = models.Project(
            name=file.filename.replace(".zip", ""),
            framework=framework,
            project_type=project_type,
            extracted_path=root_dir,
            owner_id=current_user.id,
            status="uploaded",
        )
        db.add(project)
        db.commit()
        db.refresh(project)

        # Audit
        audit_service.log_upload(db, current_user.id, project.id, project.name, framework)

        # Dispatch Celery Task
        analyze_project_task.delay(project.id)

        success = True

        return {
            "message": "Project uploaded successfully. Analysis started.",
            "project_id": project.id,
            "framework": framework,
            "project_type": project_type,
            "status": "uploaded",
        }

    except HTTPException:
        raise
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP file")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(zip_path):
            os.remove(zip_path)
        if not success and os.path.exists(extract_path):
            shutil.rmtree(extract_path, ignore_errors=True)


@router.get("/", response_model=list)
def list_projects(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
    skip: int = 0,
    limit: int = 20,
):
    projects = (
        db.query(models.Project)
        .filter(models.Project.owner_id == current_user.id)
        .order_by(models.Project.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": p.id,
            "name": p.name,
            "framework": p.framework,
            "project_type": p.project_type,
            "readiness_score": p.readiness_score,
            "repository_url": p.repository_url,
            "created_at": p.created_at.isoformat(),
        }
        for p in projects
    ]


@router.get("/{project_id}")
async def get_project(
    request: Request,
    project_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    await rate_limit(request, "poll", 500, 3600)
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    latest_deployment = (
        db.query(models.Deployment)
        .filter(models.Deployment.project_id == project_id)
        .order_by(models.Deployment.created_at.desc())
        .first()
    )

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "framework": project.framework,
        "project_type": project.project_type,
        "readiness_score": project.readiness_score,
        "repository_url": project.repository_url,
        "github_repo_name": project.github_repo_name,
        "ai_analysis": project.ai_analysis,
        "security_scan": project.security_scan,
        "malware_scan": project.malware_scan,
        "code_review": project.code_review,
        "created_at": project.created_at.isoformat(),
        "latest_deployment": {
            "id": latest_deployment.id,
            "status": latest_deployment.status,
            "deployment_url": latest_deployment.deployment_url,
            "provider": latest_deployment.provider,
        } if latest_deployment else None,
    }


@router.delete("/{project_id}")
def delete_project(
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
    db.delete(project)
    db.commit()
    return {"message": "Project deleted", "success": True}


@router.post("/{project_id}/fix")
def fix_project(
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
    if not project.extracted_path or not os.path.exists(project.extracted_path):
        raise HTTPException(status_code=400, detail="Project files no longer available for analysis")

    result = fix_my_project(project.extracted_path, project.framework or "Unknown")
    return {"project_id": project_id, "fix_analysis": result}


@router.get("/{project_id}/env-vars")
def list_env_vars(
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

    env_vars = db.query(models.EnvironmentConfig).filter(
        models.EnvironmentConfig.project_id == project_id
    ).all()

    from utils.encryption import decrypt_value
    
    return [
        {
            "id": e.id,
            "key": e.key,
            "value": "***" if e.is_secret else e.value,
            "is_secret": e.is_secret,
            "environment": e.environment,
        }
        for e in env_vars
    ]


@router.post("/{project_id}/env-vars")
def add_env_var(
    project_id: int,
    env_var: schemas.EnvVarCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    from utils.encryption import encrypt_value
    
    stored_value = encrypt_value(env_var.value) if env_var.is_secret else env_var.value

    new_var = models.EnvironmentConfig(
        project_id=project_id,
        key=env_var.key,
        value=stored_value,
        is_secret=env_var.is_secret,
        environment=env_var.environment,
    )
    db.add(new_var)
    db.commit()
    return {"message": "Environment variable added", "key": env_var.key}


@router.delete("/{project_id}/env-vars/{var_id}")
def delete_env_var(
    project_id: int,
    var_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    var = db.query(models.EnvironmentConfig).filter(
        models.EnvironmentConfig.id == var_id,
        models.EnvironmentConfig.project_id == project_id,
    ).first()
    if not var:
        raise HTTPException(status_code=404, detail="Variable not found")

    db.delete(var)
    db.commit()
    return {"message": "Variable deleted"}
