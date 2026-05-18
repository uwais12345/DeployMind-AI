import os
import requests
import time
from typing import Dict, Any, List
from .base import BaseProvider

class VercelProvider(BaseProvider):
    """
    Vercel Implementation of BaseProvider.
    Uses Vercel REST API v13 for deployments and project management.
    """

    def __init__(self, token: str = None):
        self.token = token or os.getenv("VERCEL_API_TOKEN") or os.getenv("VERCEL_TOKEN")
        self.team_id = os.getenv("VERCEL_TEAM_ID") # Optional
        self.api_base = "https://api.vercel.com"

    def _headers(self) -> Dict[str, str]:
        if not self.token:
            raise Exception("VERCEL_API_TOKEN not configured in environment")
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def _get_url(self, path: str) -> str:
        url = f"{self.api_base}{path}"
        if self.team_id:
            url += f"?teamId={self.team_id}"
        return url

    def deploy(self, project_name: str, repo_url: str, framework: str, env_vars: Dict[str, str] = None) -> Dict[str, Any]:
        """
        Trigger a Vercel deployment linked to a GitHub repository.
        """
        try:
            # 1. Normalize project name
            safe_name = project_name.lower().replace(" ", "-").replace("_", "-")
            
            # 2. Map framework to Vercel presets
            framework_map = {
                "Next.js": "nextjs",
                "Vite/React": "vite",
                "React": "create-react-app",
                "Vue": "vue",
                "SvelteKit": "sveltekit",
                "Nuxt": "nuxtjs",
                "Gatsby": "gatsby",
                "Angular": "angular",
            }
            framework_preset = framework_map.get(framework, None) # None lets Vercel auto-detect

            # 3. Create/Link Project (ensure it exists and has git linked)
            # This is a simplification: we'll use the v13 deployments endpoint directly 
            # which can create a deployment from a git source.
            
            # Extract owner/repo from repo_url
            # Expected: https://github.com/owner/repo
            repo_parts = repo_url.replace("https://github.com/", "").split("/")
            if len(repo_parts) < 2:
                return {"success": False, "error": f"Invalid GitHub repo URL: {repo_url}"}
            
            github_org, github_repo = repo_parts[0], repo_parts[1]

            payload = {
                "name": safe_name,
                "gitSource": {
                    "type": "github",
                    "repoId": None, # Vercel prefers repoId, but can use full path if correctly configured
                    "org": github_org,
                    "repo": github_repo,
                    "ref": "main",
                }
            }
            
            if framework_preset:
                payload["projectSettings"] = {"framework": framework_preset}

            # Handle environment variables
            # Vercel v13 deployments API expects 'env' as a map or list depending on the specific endpoint version
            # For simplicity in this MVP, we'll assume the project is already set up or let Vercel handle it.
            
            resp = requests.post(
                self._get_url("/v13/deployments"),
                json=payload,
                headers=self._headers()
            )

            if resp.status_code in (200, 201):
                data = resp.json()
                return {
                    "success": True,
                    "provider_deployment_id": data.get("id"),
                    "deployment_url": f"https://{data.get('url', '')}",
                    "status": data.get("status", "INITIALIZING").lower()
                }
            else:
                error_data = resp.json() if resp.text else {}
                error_msg = error_data.get("error", {}).get("message", f"Vercel API error: {resp.status_code}")
                return {"success": False, "error": error_msg}

        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_deployment_status(self, provider_deployment_id: str) -> Dict[str, Any]:
        """
        Poll Vercel for the status of a specific deployment.
        """
        try:
            resp = requests.get(
                self._get_url(f"/v13/deployments/{provider_deployment_id}"),
                headers=self._headers()
            )

            if resp.status_code == 200:
                data = resp.json()
                vercel_status = data.get("status", "READY")
                
                # Normalize Vercel status to internal status
                # Vercel statuses: INITIALIZING, ANALYZING, BUILDING, DEPLOYING, READY, ERROR, CANCELED
                status_map = {
                    "INITIALIZING": "preparing",
                    "ANALYZING": "building",
                    "BUILDING": "building",
                    "DEPLOYING": "deploying",
                    "READY": "ready",
                    "ERROR": "error",
                    "CANCELED": "canceled"
                }
                
                return {
                    "status": status_map.get(vercel_status, "building"),
                    "ready": vercel_status == "READY",
                    "deployment_url": f"https://{data.get('url', '')}" if vercel_status == "READY" else None,
                    "error": data.get("error", {}).get("message") if vercel_status == "ERROR" else None
                }
            else:
                return {"status": "error", "ready": False, "error": f"Failed to fetch status: {resp.status_code}"}

        except Exception as e:
            return {"status": "error", "ready": False, "error": str(e)}

    def cancel_deployment(self, provider_deployment_id: str) -> Dict[str, Any]:
        """
        Cancel a running Vercel deployment.
        """
        try:
            resp = requests.patch(
                self._get_url(f"/v12/deployments/{provider_deployment_id}/cancel"),
                headers=self._headers()
            )
            return {"success": resp.status_code in (200, 201)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_logs(self, provider_deployment_id: str) -> Dict[str, Any]:
        """
        Fetch deployment logs. 
        Note: Vercel's real-time logs API is complex. For the MVP, we'll fetch the build events.
        """
        try:
            resp = requests.get(
                self._get_url(f"/v2/deployments/{provider_deployment_id}/events"),
                headers=self._headers()
            )
            
            if resp.status_code == 200:
                events = resp.json()
                normalized_logs = []
                for event in events:
                    # Vercel events can be lists of strings or objects
                    if isinstance(event, dict) and "text" in event:
                        normalized_logs.append({
                            "timestamp": event.get("created", time.time() * 1000) / 1000,
                            "message": event["text"],
                            "level": "info" if event.get("type") != "stderr" else "error"
                        })
                return {"success": True, "logs": normalized_logs}
            else:
                return {"success": False, "error": f"Failed to fetch logs: {resp.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
