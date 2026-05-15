import time
import random
import uuid
from typing import Dict, Any
from .base import BaseProvider

class MockProvider(BaseProvider):
    """
    Mock Provider that simulates deployment processes.
    Generates fake deployment IDs, simulated delays, and random failure paths.
    """

    def deploy(self, project_name: str, repo_url: str, framework: str, env_vars: Dict[str, str] = None) -> Dict[str, Any]:
        # Simulate network delay for API request
        time.sleep(1.5)
        
        # 10% chance to simulate a provider API failure (e.g., rate limit, 500 error)
        if random.random() < 0.1:
            return {
                "success": False,
                "provider_deployment_id": None,
                "error": "MockProvider API error: Rate limit exceeded or internal error."
            }

        provider_id = f"mock-dep-{uuid.uuid4().hex[:8]}"
        
        return {
            "success": True,
            "provider_deployment_id": provider_id,
            "deployment_url": f"https://{project_name}-mock.vercel.app",
        }

    def get_deployment_status(self, provider_deployment_id: str) -> Dict[str, Any]:
        # Simulate network delay
        time.sleep(0.5)
        
        # Since this is a mock and we don't hold state across requests without DB,
        # we will randomly simulate states for demonstration, but in our Celery task, 
        # we actually handle the state machine locally for the MVP.
        return {
            "status": "ready",
            "ready": True
        }

    def cancel_deployment(self, provider_deployment_id: str) -> Dict[str, Any]:
        time.sleep(0.5)
        return {"success": True}

    def get_logs(self, provider_deployment_id: str) -> Dict[str, Any]:
        time.sleep(0.2)
        return {
            "success": True,
            "logs": [
                {"timestamp": time.time(), "message": "Mock log entry 1", "level": "info"},
                {"timestamp": time.time(), "message": "Mock log entry 2", "level": "info"},
            ]
        }

