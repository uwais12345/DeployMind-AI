"""
Deployment Service
Orchestrates deployments to Vercel, Render, Railway, and Netlify via their APIs.
"""

import os
import requests
import time
from typing import Dict, Any, Optional, Callable

VERCEL_TOKEN = os.getenv("VERCEL_TOKEN", "")
RENDER_API_KEY = os.getenv("RENDER_API_KEY", "")
RAILWAY_TOKEN = os.getenv("RAILWAY_TOKEN", "")
NETLIFY_TOKEN = os.getenv("NETLIFY_TOKEN", "")


def deploy_to_vercel(repo_url: str, project_name: str, framework: str, env_vars: Dict[str, str] = None) -> Dict[str, Any]:
    """Trigger a Vercel deployment via Vercel API."""
    if not VERCEL_TOKEN:
        return {"success": False, "error": "VERCEL_TOKEN not configured", "provider": "vercel"}

    headers = {
        "Authorization": f"Bearer {VERCEL_TOKEN}",
        "Content-Type": "application/json",
    }

    # Determine framework preset for Vercel
    framework_map = {
        "Next.js": "nextjs",
        "Vite/React": "vite",
        "React": "create-react-app",
        "Vue": "vue",
        "Angular": "angular",
        "Static": "html",
    }
    framework_preset = framework_map.get(framework, "other")

    payload = {
        "name": project_name.lower().replace(" ", "-").replace("_", "-"),
        "gitSource": {
            "type": "github",
            "repoUrl": repo_url,
            "ref": "main",
        },
        "framework": framework_preset,
    }

    if env_vars:
        payload["env"] = [{"key": k, "value": v} for k, v in env_vars.items()]

    resp = requests.post(
        "https://api.vercel.com/v13/deployments",
        json=payload,
        headers=headers,
    )

    if resp.status_code in (200, 201):
        data = resp.json()
        return {
            "success": True,
            "provider": "vercel",
            "deployment_id": data.get("id"),
            "deployment_url": f"https://{data.get('url', '')}",
            "status": data.get("status", "building"),
        }
    else:
        return {
            "success": False,
            "provider": "vercel",
            "error": f"Vercel API error {resp.status_code}",
            "detail": resp.text[:500],
        }


def deploy_to_render(repo_url: str, project_name: str, framework: str, env_vars: Dict[str, str] = None) -> Dict[str, Any]:
    """Create a Render web service deployment."""
    if not RENDER_API_KEY:
        return {"success": False, "error": "RENDER_API_KEY not configured", "provider": "render"}

    headers = {
        "Authorization": f"Bearer {RENDER_API_KEY}",
        "Content-Type": "application/json",
    }

    is_backend = any(kw in framework for kw in ["FastAPI", "Flask", "Django", "Express", "Node"])

    payload = {
        "type": "web_service",
        "name": project_name.lower().replace(" ", "-"),
        "repo": repo_url,
        "branch": "main",
        "buildCommand": "pip install -r requirements.txt" if is_backend else "npm install && npm run build",
        "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT" if "FastAPI" in framework else "node index.js",
        "envVars": [{"key": k, "value": v} for k, v in (env_vars or {}).items()],
        "plan": "free",
        "region": "oregon",
    }

    resp = requests.post(
        "https://api.render.com/v1/services",
        json=payload,
        headers=headers,
    )

    if resp.status_code in (200, 201):
        data = resp.json()
        svc = data.get("service", data)
        return {
            "success": True,
            "provider": "render",
            "service_id": svc.get("id"),
            "deployment_url": svc.get("serviceDetails", {}).get("url", ""),
            "status": "deploying",
        }
    else:
        return {
            "success": False,
            "provider": "render",
            "error": f"Render API error {resp.status_code}",
            "detail": resp.text[:500],
        }


def deploy_to_railway(repo_url: str, project_name: str, env_vars: Dict[str, str] = None) -> Dict[str, Any]:
    """Create a Railway project and trigger deployment via Railway API."""
    if not RAILWAY_TOKEN:
        return {"success": False, "error": "RAILWAY_TOKEN not configured", "provider": "railway"}

    headers = {
        "Authorization": f"Bearer {RAILWAY_TOKEN}",
        "Content-Type": "application/json",
    }

    # Railway uses GraphQL API
    mutation = """
    mutation projectCreate($input: ProjectCreateInput!) {
      projectCreate(input: $input) {
        id
        name
        deployments {
          edges {
            node {
              id
              url
            }
          }
        }
      }
    }
    """

    resp = requests.post(
        "https://backboard.railway.app/graphql/v2",
        json={"query": mutation, "variables": {"input": {"name": project_name}}},
        headers=headers,
    )

    if resp.status_code == 200:
        data = resp.json()
        project = data.get("data", {}).get("projectCreate", {})
        return {
            "success": True,
            "provider": "railway",
            "project_id": project.get("id"),
            "deployment_url": f"https://{project_name.lower()}.up.railway.app",
            "status": "deploying",
        }
    else:
        return {
            "success": False,
            "provider": "railway",
            "error": f"Railway API error {resp.status_code}",
        }


def deploy_to_netlify(project_name: str, env_vars: Dict[str, str] = None) -> Dict[str, Any]:
    """Create a Netlify site."""
    if not NETLIFY_TOKEN:
        return {"success": False, "error": "NETLIFY_TOKEN not configured", "provider": "netlify"}

    headers = {
        "Authorization": f"Bearer {NETLIFY_TOKEN}",
        "Content-Type": "application/json",
    }

    payload = {
        "name": project_name.lower().replace(" ", "-"),
        "custom_domain": None,
    }

    resp = requests.post(
        "https://api.netlify.com/api/v1/sites",
        json=payload,
        headers=headers,
    )

    if resp.status_code in (200, 201):
        data = resp.json()
        return {
            "success": True,
            "provider": "netlify",
            "site_id": data.get("id"),
            "deployment_url": f"https://{data.get('subdomain', project_name)}.netlify.app",
            "status": "deploying",
        }
    else:
        return {
            "success": False,
            "provider": "netlify",
            "error": f"Netlify API error {resp.status_code}",
        }


def select_provider_for_framework(framework: str, provider_preference: str = None) -> str:
    """Select the best deployment provider based on framework type."""
    if provider_preference:
        return provider_preference

    frontend_providers = {"Next.js": "vercel", "Vite/React": "vercel", "React": "vercel", "Static": "netlify", "Vue": "netlify"}
    backend_providers = {"FastAPI/Python": "render", "Flask": "render", "Django": "railway", "Express.js": "render", "Node.js": "render"}

    if framework in frontend_providers:
        return frontend_providers[framework]
    if framework in backend_providers:
        return backend_providers[framework]
    return "vercel"


def simulate_deployment_stages(
    project_id: int,
    framework: str,
    provider: str,
    log_callback: Optional[Callable] = None,
) -> Dict[str, Any]:
    """
    Simulate deployment stages for demo purposes when real API keys are not configured.
    Returns a mock successful deployment result.
    """
    stages = [
        ("queued", "Deployment queued", 0.5),
        ("scanning", "Running security scan", 1),
        ("analyzing", "Analyzing project structure with AI", 1.5),
        ("uploading", "Uploading project files", 1),
        ("building", "Building project", 2),
        ("deploying", "Deploying to " + provider, 1.5),
    ]

    for stage, message, delay in stages:
        if log_callback:
            log_callback(stage=stage, message=message, level="info")
        time.sleep(delay)

    mock_url = f"https://{project_id}-deploymind.vercel.app"
    if log_callback:
        log_callback(stage="completed", message=f"Deployment live at {mock_url}", level="success")

    return {
        "success": True,
        "provider": provider,
        "deployment_url": mock_url,
        "status": "completed",
        "simulated": True,
    }
