from workers.celery_app import celery_app
import time, os, datetime
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)


def get_db_session():
    """Get a DB session for use inside Celery tasks."""
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from database import SessionLocal
    return SessionLocal()


def add_log(db, deployment_id: int, stage: str, message: str, level: str = "info"):
    """Persist a deployment log entry and broadcast to WS."""
    import models
    from utils import broadcaster
    log = models.DeploymentLog(
        deployment_id=deployment_id,
        stage=stage,
        message=message,
        level=level,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(log)
    db.commit()
    
    # Real-time broadcast
    try:
        broadcaster.publish_log(deployment_id, stage, message, level)
    except Exception as e:
        logger.warning(f"Failed to broadcast log: {e}")


def update_deployment_status(db, deployment_id: int, status: str, **kwargs):
    """Update deployment status and broadcast to WS."""
    import models
    from utils import broadcaster
    deployment = db.query(models.Deployment).filter(models.Deployment.id == deployment_id).first()
    if deployment:
        deployment.status = status
        for key, value in kwargs.items():
            setattr(deployment, key, value)
        db.commit()
        
        # Real-time broadcast
        try:
            broadcaster.publish_status(deployment_id, status, kwargs)
        except Exception as e:
            logger.warning(f"Failed to broadcast status: {e}")



@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def deploy_project_task(self, deployment_id: int, project_id: int, extracted_path: str, framework: str, provider: str):
    """
    Mock Deployment State Machine pipeline:
    queued -> preparing -> creating_repository -> pushing_code -> provisioning -> building -> deploying -> verifying -> completed
    """
    db: Session = get_db_session()
    start_time = time.time()

    try:
        import models
        from integrations.providers.mock_provider import MockProvider
        from integrations.providers.vercel_provider import VercelProvider
        from integrations.providers.render_provider import RenderProvider
        from services import github_service

        deployment = db.query(models.Deployment).filter(models.Deployment.id == deployment_id).first()
        if not deployment or deployment.status in ("cancelled", "failed"):
            return {"status": "aborted", "reason": "Deployment not found or already cancelled/failed"}

        # Initialize Provider
        prov_instance = None
        if provider != "mock":
            # Fetch user credentials
            project = db.query(models.Project).filter(models.Project.id == project_id).first()
            if project:
                cred = db.query(models.ProviderCredential).filter(
                    models.ProviderCredential.user_id == project.owner_id,
                    models.ProviderCredential.provider == provider,
                    models.ProviderCredential.is_active == True
                ).first()
                
                if cred:
                    from utils.encryption import decrypt_value
                    token = decrypt_value(cred.encrypted_token)
                    if token:
                        cred.last_used_at = datetime.datetime.utcnow()
                        db.commit()
                        
                        if provider == "vercel":
                            prov_instance = VercelProvider(token=token)
                        elif provider == "render":
                            prov_instance = RenderProvider(api_key=token)
                            
        # Fallbacks
        if not prov_instance:
            if provider != "mock":
                add_log(db, deployment_id, "failed", f"Provider '{provider}' token not configured or invalid. Falling back to MockProvider.", "warning")
            prov_instance = MockProvider()

        # Helper to progress state machine
        def transition(stage: str, msg: str, level: str = "info", delay: float = 1.0):
            if delay:
                time.sleep(delay)
            
            # Check for timeout (10 minute limit)
            if time.time() - start_time > 600:
                add_log(db, deployment_id, stage, "Deployment timed out after 10 minutes.", "error")
                raise Exception("DeploymentTimeout")

            self.update_state(state="PROGRESS", meta={"stage": stage})
            update_deployment_status(db, deployment_id, stage)
            add_log(db, deployment_id, stage, msg, level)
            
            # Check for cancellation between stages
            db.refresh(deployment)
            if deployment.status == "cancelled":
                add_log(db, deployment_id, stage, "Deployment was cancelled by user.", "warning")
                raise Exception("DeploymentCancelled")

        # ── STAGE: preparing ──────────────────────────────
        transition("preparing", "Preparing deployment environment...", "info", delay=0.5)

        # ── STAGE: creating_repository ─────────────────────
        transition("creating_repository", f"Provisioning GitHub repository for {framework} project...", "info", delay=0.5)
        
        repo_name = f"deploymind-{project_id}-{framework.lower().replace('/', '-').replace(' ', '-')}"
        github_res = github_service.create_github_repo(repo_name, private=True)
        
        if not github_res["success"] and "already exists" not in github_res.get("error", ""):
            add_log(db, deployment_id, "failed", f"GitHub Error: {github_res.get('error')}", "error")
            raise Exception(f"GitHubProvisioningFailed: {github_res.get('error')}")
            
        repo_url = github_res.get("html_url") or f"https://github.com/{github_service.get_github_user().get('login')}/{repo_name}"
        clone_url = github_res.get("clone_url") or f"https://github.com/{github_service.get_github_user().get('login')}/{repo_name}.git"

        # ── STAGE: pushing_code ────────────────────────────
        transition("pushing_code", "Pushing source code to GitHub repository...", "info", delay=0.5)
        
        if extracted_path and os.path.exists(extracted_path):
            push_res = github_service.push_to_github(extracted_path, clone_url)
            if not push_res["success"]:
                add_log(db, deployment_id, "failed", f"Git Push Error: {push_res.get('error')}", "error")
                raise Exception(f"GitPushFailed: {push_res.get('error')}")
            add_log(db, deployment_id, "pushing_code", f"Code pushed successfully (commit: {push_res['commit']})", "success")
        else:
            add_log(db, deployment_id, "pushing_code", "Project files missing from local storage. Skipping push.", "warning")

        # ── STAGE: provisioning ────────────────────────────
        transition("provisioning", f"Linking project to {provider} and triggering deployment...", "info", delay=0.5)
        
        project_name = f"deploymind-proj-{project_id}"
        deploy_res = prov_instance.deploy(project_name, repo_url, framework)
        
        if not deploy_res.get("success"):
            raise Exception(deploy_res.get("error", "Provider rejected deployment request."))
            
        provider_deployment_id = deploy_res["provider_deployment_id"]
        deployment.provider_deployment_id = provider_deployment_id
        db.commit()
        
        # ── STAGE: building / deploying / verifying ────────
        # For real providers, we poll for status
        is_mock = isinstance(prov_instance, MockProvider)
        max_polls = 60 # 10 minutes at 10s interval
        poll_count = 0
        
        while poll_count < max_polls:
            poll_count += 1
            status_res = prov_instance.get_deployment_status(provider_deployment_id)
            
            curr_prov_status = status_res.get("status", "building")
            msg = status_res.get("error") or f"{provider.capitalize()} status: {curr_prov_status.upper()}"
            
            # Sync logs if available
            log_res = prov_instance.get_logs(provider_deployment_id)
            if log_res.get("success"):
                for plog in log_res.get("logs", []):
                    # In a real system, we'd avoid duplicates. 
                    # For MVP, we'll just log the status transitions.
                    pass

            if curr_prov_status == "ready":
                deployment_url = status_res["deployment_url"]
                break
            elif curr_prov_status == "error":
                raise Exception(f"ProviderDeploymentFailed: {status_res.get('error', 'Unknown error')}")
            elif curr_prov_status == "canceled":
                raise Exception("DeploymentCancelledByProvider")
            
            # Update local state machine based on provider status
            if curr_prov_status in ("preparing", "building", "deploying", "verifying"):
                transition(curr_prov_status, msg, "info", delay=0) # delay 0 since we are in a loop
            
            time.sleep(10) # Poll interval
        else:
            raise Exception("DeploymentTimeout: Provider did not complete in time.")

        # ── STAGE: completed ──────────────────────────────

        duration = int(time.time() - start_time)
        update_deployment_status(
            db, deployment_id, "completed",
            deployment_url=deployment_url,
            completed_at=datetime.datetime.utcnow(),
            build_duration_seconds=duration,
        )
        add_log(db, deployment_id, "completed", f"🎉 Deployment live at: {deployment_url}", "success")
        add_log(db, deployment_id, "completed", f"Total build time: {duration}s", "info")

        return {
            "status": "success",
            "deployment_id": deployment_id,
            "project_id": project_id,
            "deployment_url": deployment_url,
            "duration_seconds": duration,
        }

    except Exception as exc:
        exc_str = str(exc)
        is_cancelled = exc_str == "DeploymentCancelled"
        is_timeout = exc_str == "DeploymentTimeout"
        
        final_status = "cancelled" if is_cancelled else "failed"
        log_level = "warning" if is_cancelled else "error"
        
        if is_cancelled:
            msg = "Deployment cancelled."
        elif is_timeout:
            msg = "Deployment failed: Orchestration timeout (10m limit exceeded)."
        else:
            msg = f"Deployment failed: {exc_str}"
        
        add_log(db, deployment_id, final_status, msg, log_level)
        update_deployment_status(
            db, deployment_id, final_status,
            error_message=msg if not is_cancelled else None,
            completed_at=datetime.datetime.utcnow(),
        )
        
        if not is_cancelled and not is_timeout:
            try:
                raise self.retry(exc=exc)
            except Exception:
                return {"status": "failed", "error": msg}
        return {"status": final_status}
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=1)
def analyze_project_task(self, project_id: int):
    """
    Background analysis task:
    Runs malware scan, secret scan, AI code review, and AI readiness.
    Updates project status throughout the process.
    """
    db: Session = get_db_session()
    try:
        import models
        from services.security_scanner import scan_project_for_secrets
        from services.malware_detector import scan_project_for_malware
        from services.ai_service import analyze_project, run_code_review
        
        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project or not project.extracted_path or not os.path.exists(project.extracted_path):
            if project:
                project.status = "failed"
                db.commit()
            return {"status": "failed", "error": "Project or files not found"}
            
        # 1. SCANNING
        project.status = "scanning"
        from utils import broadcaster
        broadcaster.publish_project_status(project.id, "scanning")
        db.commit()
        
        malware_scan = scan_project_for_malware(project.extracted_path)
        security_scan = scan_project_for_secrets(project.extracted_path)
        
        if malware_scan.get("blocked_deployment"):
            project.status = "failed"
            project.malware_scan = malware_scan
            db.commit()
            return {"status": "failed", "error": "Malware detected"}
            
        # 2. AI ANALYZING
        project.status = "ai_analyzing"
        from utils import broadcaster
        broadcaster.publish_project_status(project.id, "ai_analyzing")
        db.commit()
        
        ai_analysis_dict, raw_ai_str = analyze_project(project.extracted_path, project.framework)
        code_review_dict, raw_cr_str = run_code_review(project.extracted_path, project.framework)
        
        # 3. PERSISTING RESULTS
        project.status = "persisting_results"
        db.commit()
        
        readiness_score = float(ai_analysis_dict.get("score", 50))
        
        project.ai_analysis = ai_analysis_dict
        project.raw_ai_analysis = {"readiness": raw_ai_str, "code_review": raw_cr_str}
        project.security_scan = security_scan
        project.malware_scan = malware_scan
        project.code_review = code_review_dict
        project.readiness_score = readiness_score
        
        sec_record = models.SecurityScan(
            project_id=project.id,
            scan_status="completed",
            exposed_secrets=security_scan.get("findings", []),
            malware_findings=malware_scan.get("findings", []),
            is_safe=security_scan.get("is_safe", True) and malware_scan.get("is_safe", True),
            risk_level=security_scan.get("risk_level", "low"),
            total_findings=security_scan.get("total_findings", 0) + malware_scan.get("total_findings", 0),
            blocked_deployment=malware_scan.get("blocked_deployment", False),
        )
        db.add(sec_record)
        
        cr_record = models.CodeReview(
            project_id=project.id,
            total_issues=code_review_dict.get("total_issues", 0),
            critical_count=code_review_dict.get("critical_count", 0),
            warning_count=code_review_dict.get("warning_count", 0),
            info_count=code_review_dict.get("info_count", 0),
            security_issues=code_review_dict.get("security_issues", []),
            code_smells=code_review_dict.get("code_smells", []),
            performance_issues=code_review_dict.get("performance_issues", []),
            architecture_issues=code_review_dict.get("architecture_issues", []),
            dependency_issues=code_review_dict.get("dependency_issues", []),
            overall_quality_score=float(code_review_dict.get("overall_quality_score", 0)),
            summary=code_review_dict.get("summary", ""),
        )
        db.add(cr_record)
        
        ai_record = models.AIReport(
            project_id=project.id,
            report_type="deployment_readiness",
            readiness_score=readiness_score,
            issues=ai_analysis_dict.get("issues", []),
            recommendations=ai_analysis_dict.get("recommendations", []),
            summary=ai_analysis_dict.get("summary", ""),
            raw_response={"readiness": raw_ai_str, "code_review": raw_cr_str},
            model_used="llama3-8b-8192",
        )
        db.add(ai_record)
        
        project.status = "completed"
        from services import audit_service
        audit_service.log_analysis_completed(db, project.owner_id, project.id, project.name, readiness_score)
        from utils import broadcaster
        broadcaster.publish_project_status(project.id, "completed", {"score": readiness_score})
        db.commit()
        
        return {"status": "success", "project_id": project.id}

    except Exception as exc:
        logger.error(f"Analysis task failed: {exc}")
        if 'project' in locals() and project:
            project.status = "failed"
            db.commit()
        return {"status": "failed", "error": str(exc)}
    finally:
        db.close()
