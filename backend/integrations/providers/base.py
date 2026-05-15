from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseProvider(ABC):
    """
    Abstract Base Class for all Deployment Providers.
    Ensures a standardized interface for deploying, tracking, and canceling.
    """

    @abstractmethod
    def deploy(self, project_name: str, repo_url: str, framework: str, env_vars: Dict[str, str] = None) -> Dict[str, Any]:
        """
        Start the deployment process.
        Should return a dictionary containing at least:
        - success: bool
        - provider_deployment_id: str
        - deployment_url: str (if available immediately)
        - error: str (if failed)
        """
        pass

    @abstractmethod
    def get_deployment_status(self, provider_deployment_id: str) -> Dict[str, Any]:
        """
        Get the current status of the deployment.
        Should return a dictionary containing at least:
        - status: str (e.g., building, ready, error, canceled)
        - deployment_url: str (if ready)
        - ready: bool
        """
        pass

    @abstractmethod
    def cancel_deployment(self, provider_deployment_id: str) -> Dict[str, Any]:
        """
        Cancel an ongoing deployment.
        Should return a dictionary containing:
        - success: bool
        - error: str (if failed)
        """
        pass

    @abstractmethod
    def get_logs(self, provider_deployment_id: str) -> Dict[str, Any]:
        """
        Fetch logs from the provider for a specific deployment.
        Should return a dictionary containing:
        - success: bool
        - logs: List[Dict[str, Any]] (normalized logs)
        - error: str (if failed)
        """
        pass

