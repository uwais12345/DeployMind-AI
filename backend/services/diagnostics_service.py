import logging
from typing import List, Dict, Any
from services.ai_service import get_groq_client
import json

logger = logging.getLogger(__name__)

def analyze_deployment_failure(logs: List[str], framework: str, provider: str) -> Dict[str, Any]:
    """
    Analyze deployment logs using AI to suggest a fix.
    """
    client = get_groq_client()
    if not client:
        return {"error": "AI service unavailable"}

    log_snippet = "\n".join(logs[-50:]) # Take last 50 lines
    
    prompt = f"""
    Analyze the following deployment logs for a {framework} app on {provider}.
    Identify the root cause of the failure and suggest a specific remediation.
    
    LOGS:
    {log_snippet}
    
    Return a JSON object with:
    - "reason": A short description of why it failed.
    - "fix_suggestion": A clear step-by-step fix.
    - "severity": "critical" or "warning".
    - "category": "build_error", "runtime_error", "config_error", "auth_error", or "unknown".
    """

    try:
        response = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.error(f"Diagnostics AI error: {e}")
        return {"error": "Failed to analyze logs", "detail": str(e)}
