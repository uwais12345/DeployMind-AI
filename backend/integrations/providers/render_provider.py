import os
import requests
import time
from typing import Dict, Any, List, Optional
from .base import BaseProvider

class RenderProvider(BaseProvider):
    """
    Render Implementation of BaseProvider.
    Uses Render REST API v1 for service management and deployments.
    """

    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("RENDER_API_KEY")
        self.api_base = "https://api.render.com/v1"

    def _headers(self) -> Dict[str, str]:
        if not self.api_key:
            raise Exception("RENDER_API_KEY not configured in environment")
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    def deploy(self, project_name: str, repo_url: str, framework: str, env_vars: Dict[str, str] = None) -> Dict[str, Any]:
        """
        Create a Render service and trigger initial deployment.
        """
        try:
            # 1. Framework Mapping & Config Generation
            service_config = self._map_framework_to_render_config(framework, project_name, repo_url, env_vars)
            
            # 2. Create Service
            # Note: Render doesn't allow duplicate names easily, so we handle that or assume unique names
            resp = requests.post(
                f"{self.api_base}/services",
                json=service_config,
                headers=self._headers()
            )

            if resp.status_code in (200, 201, 202):
                data = resp.json()
                # Render returns service info. The initial deployment is usually triggered automatically.
                service = data.get("service", data)
                service_id = service.get("id")
                
                # If we need to trigger a manual deployment immediately (optional)
                # deploy_resp = requests.post(f"{self.api_base}/services/{service_id}/deploys", headers=self._headers())
                
                return {
                    "success": True,
                    "provider_deployment_id": service_id, # In Render, we track the service ID primarily for status polling
                    "deployment_url": service.get("serviceDetails", {}).get("url", ""),
                    "status": "building"
                }
            else:
                error_data = resp.json() if resp.text else {}
                error_msg = error_data.get("message", f"Render API error: {resp.status_code}")
                return {"success": False, "error": error_msg}

        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_deployment_status(self, provider_deployment_id: str) -> Dict[str, Any]:
        """
        Poll Render for the status of the latest deployment of a service.
        provider_deployment_id is the Service ID.
        """
        try:
            # 1. Fetch latest deployment for this service
            resp = requests.get(
                f"{self.api_base}/services/{provider_deployment_id}/deploys",
                headers=self._headers(),
                params={"limit": 1}
            )

            if resp.status_code == 200:
                deploys = resp.json()
                if not deploys:
                    return {"status": "preparing", "ready": False}
                
                latest = deploys[0].get("deploy", deploys[0])
                render_status = latest.get("status", "").lower()
                
                # Render statuses: created, build_in_progress, update_in_progress, live, deactivated, build_failed, update_failed, canceled
                status_map = {
                    "created": "preparing",
                    "build_in_progress": "building",
                    "update_in_progress": "deploying",
                    "live": "ready",
                    "build_failed": "error",
                    "update_failed": "error",
                    "canceled": "canceled",
                    "deactivated": "canceled"
                }
                
                # Fetch service details for URL
                svc_resp = requests.get(f"{self.api_base}/services/{provider_deployment_id}", headers=self._headers())
                deployment_url = ""
                if svc_resp.status_code == 200:
                    svc_data = svc_resp.json()
                    service = svc_data.get("service", svc_data)
                    deployment_url = service.get("serviceDetails", {}).get("url", "")

                return {
                    "status": status_map.get(render_status, "building"),
                    "ready": render_status == "live",
                    "deployment_url": deployment_url if render_status == "live" else None,
                    "error": "Deployment failed on Render" if "failed" in render_status else None
                }
            else:
                return {"status": "error", "ready": False, "error": f"Failed to fetch status: {resp.status_code}"}

        except Exception as e:
            return {"status": "error", "ready": False, "error": str(e)}

    def cancel_deployment(self, provider_deployment_id: str) -> Dict[str, Any]:
        """
        Cancel the latest deployment for a Render service.
        """
        try:
            # 1. Get latest deployment ID
            status_res = requests.get(
                f"{self.api_base}/services/{provider_deployment_id}/deploys",
                headers=self._headers(),
                params={"limit": 1}
            )
            if status_res.status_code == 200:
                deploys = status_res.json()
                if deploys:
                    latest_id = deploys[0].get("deploy", deploys[0]).get("id")
                    # Render doesn't have a direct "cancel" for a specific deploy via API easily 
                    # in some versions, but we can suspend the service or just let it be.
                    # For this implementation, we'll try to use the cancel endpoint if available.
                    resp = requests.post(
                        f"{self.api_base}/services/{provider_deployment_id}/deploys/{latest_id}/cancel",
                        headers=self._headers()
                    )
                    return {"success": resp.status_code in (200, 201, 204)}
            return {"success": False, "error": "No active deployment found to cancel"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_logs(self, provider_deployment_id: str) -> Dict[str, Any]:
        """
        Fetch logs from Render for a service.
        Normalizes service events as logs since historical build logs are typically streamed.
        """
        try:
            # 1. Fetch service events as a proxy for logs
            resp = requests.get(
                f"{self.api_base}/services/{provider_deployment_id}/events",
                headers=self._headers(),
                params={"limit": 10}
            )

            if resp.status_code == 200:
                events = resp.json()
                normalized_logs = []
                for item in events:
                    event = item.get("event", item)
                    msg = event.get("type", "unknown_event").replace("_", " ").capitalize()
                    
                    # Add meaningful messages for common events
                    if event.get("type") == "deployment_started":
                        msg = "Deployment started on Render"
                    elif event.get("type") == "deployment_live":
                        msg = "Deployment is now live"
                    elif event.get("type") == "build_started":
                        msg = "Build process started"
                    
                    normalized_logs.append({
                        "timestamp": time.time(), # API typically provides a createdDate
                        "message": msg,
                        "level": "info",
                        "stage": "deploying"
                    })
                return {"success": True, "logs": normalized_logs}
            else:
                return {"success": False, "error": f"Failed to fetch events: {resp.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _map_framework_to_render_config(self, framework: str, project_name: str, repo_url: str, env_vars: Dict[str, str] = None) -> Dict[str, Any]:
        """
        Internal helper to generate Render service configuration.
        """
        is_frontend = any(kw in framework for kw in ["React", "Vite", "Next.js", "Vue", "Angular", "Static"])
        is_backend = any(kw in framework for kw in ["FastAPI", "Flask", "Django", "Express", "NestJS", "Node"])
        
        # Default commands
        build_command = "npm install && npm run build"
        start_command = ""
        publish_dir = "dist"
        service_type = "static_site"

        if is_backend:
            service_type = "web_service"
            if "FastAPI" in framework:
                build_command = "pip install -r requirements.txt"
                start_command = "uvicorn main:app --host 0.0.0.0 --port 10000"
            elif "Flask" in framework:
                build_command = "pip install -r requirements.txt"
                start_command = "gunicorn app:app"
            elif "Django" in framework:
                build_command = "pip install -r requirements.txt"
                start_command = "gunicorn config.wsgi"
            elif "Express" in framework or "Node" in framework:
                build_command = "npm install"
                start_command = "npm start"
        else:
            if "Next.js" in framework:
                build_command = "npm install && npm run build"
                publish_dir = ".next" # Or 'out' for static export
            elif "React" in framework and "Vite" not in framework:
                publish_dir = "build"

        config = {
            "type": service_type,
            "name": project_name.lower().replace(" ", "-"),
            "repo": repo_url,
            "branch": "main", # Defaulting to main
            "autoDeploy": "yes",
            "serviceDetails": {
                "plan": "free",
                "region": "oregon"
            }
        }

        if service_type == "static_site":
            config["serviceDetails"]["buildCommand"] = build_command
            config["serviceDetails"]["publishDir"] = publish_dir
        else:
            config["serviceDetails"]["buildCommand"] = build_command
            config["serviceDetails"]["startCommand"] = start_command

        if env_vars:
            config["envVars"] = [{"key": k, "value": v} for k, v in env_vars.items()]

        return config
