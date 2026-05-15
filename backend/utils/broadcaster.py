import json
import datetime
from database import redis_client

def publish_deployment_event(deployment_id: int, event_name: str, payload: dict, severity: str = "info"):
    """
    Publish a standardized event to a Redis channel.
    """
    if not redis_client:
        return
        
    channel = f"deployment:{deployment_id}"
    payload = {
        "event": event_name,
        "deployment_id": deployment_id,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "severity": severity,
        "payload": payload
    }
    
    redis_client.publish(channel, json.dumps(payload))

def publish_log(deployment_id: int, stage: str, message: str, level: str = "info"):
    publish_deployment_event(deployment_id, "deployment.log", {
        "stage": stage,
        "message": message
    }, severity=level)

def publish_status(deployment_id: int, status: str, extra: dict = None):
    payload = {"status": status}
    if extra:
        payload.update(extra)
    publish_deployment_event(deployment_id, "deployment.status", payload)

def publish_project_status(project_id: int, status: str, extra: dict = None):
    """Publish project analysis status events."""
    if not redis_client:
        return
    channel = f"project:{project_id}"
    payload = {
        "event": "project.status",
        "project_id": project_id,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "severity": "info",
        "payload": {
            "status": status,
            **(extra or {})
        }
    }
    redis_client.publish(channel, json.dumps(payload))
