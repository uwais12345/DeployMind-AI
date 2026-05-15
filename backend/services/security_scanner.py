"""
Security Scanner Service
Enterprise-grade pattern-based scanning for exposed secrets, API keys,
credentials, and sensitive configuration leaks in uploaded codebases.
"""

import os
import re
import json
from typing import List, Dict, Any
from pathlib import Path

# ────────────────────────────────────────────
# SECRET DETECTION PATTERNS
# ────────────────────────────────────────────

SECRET_PATTERNS = [
    # AWS
    {
        "type": "AWS Access Key",
        "severity": "critical",
        "pattern": re.compile(r"AKIA[0-9A-Z]{16}", re.IGNORECASE),
        "description": "AWS Access Key ID detected"
    },
    {
        "type": "AWS Secret Key",
        "severity": "critical",
        "pattern": re.compile(r"(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*['\"]?([A-Za-z0-9/+=]{40})['\"]?", re.IGNORECASE),
        "description": "AWS Secret Access Key detected"
    },
    # GitHub
    {
        "type": "GitHub Token",
        "severity": "critical",
        "pattern": re.compile(r"ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|ghs_[A-Za-z0-9]{36}|github_token\s*[=:]\s*['\"]?([A-Za-z0-9_\-]{40})['\"]?", re.IGNORECASE),
        "description": "GitHub Personal Access Token detected"
    },
    # JWT Secrets
    {
        "type": "JWT Secret",
        "severity": "high",
        "pattern": re.compile(r"(?:jwt_secret|secret_key|JWT_SECRET|SECRET_KEY)\s*[=:]\s*['\"]?([A-Za-z0-9_\-!@#$%^&*]{16,})['\"]?", re.IGNORECASE),
        "description": "JWT secret key hardcoded in source"
    },
    # Database Credentials
    {
        "type": "Database Connection String",
        "severity": "critical",
        "pattern": re.compile(r"(?:postgres|mysql|mongodb|sqlite|redis):\/\/[^\s\"'<>]+:[^\s\"'<>@]+@[^\s\"'<>]+", re.IGNORECASE),
        "description": "Database connection string with credentials detected"
    },
    # API Keys (generic)
    {
        "type": "Generic API Key",
        "severity": "high",
        "pattern": re.compile(r"(?:api_key|apikey|api-key)\s*[=:]\s*['\"]?([A-Za-z0-9_\-]{20,})['\"]?", re.IGNORECASE),
        "description": "Generic API key hardcoded"
    },
    # Stripe
    {
        "type": "Stripe Secret Key",
        "severity": "critical",
        "pattern": re.compile(r"sk_live_[A-Za-z0-9]{24,}", re.IGNORECASE),
        "description": "Stripe live secret key detected"
    },
    {
        "type": "Stripe Publishable Key",
        "severity": "medium",
        "pattern": re.compile(r"pk_live_[A-Za-z0-9]{24,}", re.IGNORECASE),
        "description": "Stripe live publishable key detected"
    },
    # Google / Firebase
    {
        "type": "Google API Key",
        "severity": "high",
        "pattern": re.compile(r"AIza[0-9A-Za-z\-_]{35}", re.IGNORECASE),
        "description": "Google API key detected"
    },
    {
        "type": "Firebase Admin Key",
        "severity": "critical",
        "pattern": re.compile(r'"type":\s*"service_account"', re.IGNORECASE),
        "description": "Firebase service account credentials detected"
    },
    # Twilio
    {
        "type": "Twilio Auth Token",
        "severity": "critical",
        "pattern": re.compile(r"SK[0-9a-fA-F]{32}", re.IGNORECASE),
        "description": "Twilio SID or Auth Token detected"
    },
    # OAuth / Client Secrets
    {
        "type": "OAuth Client Secret",
        "severity": "critical",
        "pattern": re.compile(r"(?:client_secret|CLIENT_SECRET|oauth_secret)\s*[=:]\s*['\"]?([A-Za-z0-9_\-]{16,})['\"]?", re.IGNORECASE),
        "description": "OAuth client secret detected"
    },
    # Private Keys
    {
        "type": "RSA Private Key",
        "severity": "critical",
        "pattern": re.compile(r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        "description": "Private key file contents detected"
    },
    # Hardcoded Passwords
    {
        "type": "Hardcoded Password",
        "severity": "high",
        "pattern": re.compile(r"(?:password|passwd|pwd)\s*[=:]\s*['\"]([^'\"]{8,})['\"]", re.IGNORECASE),
        "description": "Hardcoded password detected"
    },
    # .env files committed
    {
        "type": ".env File",
        "severity": "medium",
        "pattern": re.compile(r"^\.env$", re.IGNORECASE),
        "description": ".env file committed to repository",
        "filename_match": True
    },
    # Groq / OpenAI / Anthropic Keys
    {
        "type": "Groq API Key",
        "severity": "high",
        "pattern": re.compile(r"gsk_[A-Za-z0-9]{40,}", re.IGNORECASE),
        "description": "Groq API key detected"
    },
    {
        "type": "OpenAI API Key",
        "severity": "critical",
        "pattern": re.compile(r"sk-[A-Za-z0-9]{48}", re.IGNORECASE),
        "description": "OpenAI API key detected"
    },
    {
        "type": "Anthropic API Key",
        "severity": "high",
        "pattern": re.compile(r"sk-ant-[A-Za-z0-9\-_]{40,}", re.IGNORECASE),
        "description": "Anthropic Claude API key detected"
    },
]

# File extensions to skip (binary files)
SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2",
    ".ttf", ".eot", ".mp4", ".mp3", ".zip", ".tar", ".gz", ".bin",
    ".exe", ".dll", ".so", ".pyc", ".lock", ".pdf", ".db", ".sqlite",
}

# Directories to skip
SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", "venv", ".venv",
    "dist", "build", ".next", ".nuxt", "coverage",
}


def _should_skip_file(file_path: str) -> bool:
    path = Path(file_path)
    if path.suffix.lower() in SKIP_EXTENSIONS:
        return True
    for part in path.parts:
        if part in SKIP_DIRS:
            return True
    return False


def _mask_value(value: str, visible_chars: int = 4) -> str:
    if len(value) <= visible_chars:
        return "*" * len(value)
    return value[:visible_chars] + "*" * (len(value) - visible_chars)


def scan_project_for_secrets(project_dir: str) -> Dict[str, Any]:
    """
    Recursively scan all files in project_dir for secret patterns.
    Returns a structured report with findings, risk level, and safety status.
    """
    findings: List[Dict[str, Any]] = []

    for root, dirs, files in os.walk(project_dir):
        # Filter skip directories in-place
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for filename in files:
            file_path = os.path.join(root, filename)
            relative_path = os.path.relpath(file_path, project_dir)

            if _should_skip_file(file_path):
                continue

            # Check filename-based patterns (e.g., .env file)
            for pattern_def in SECRET_PATTERNS:
                if pattern_def.get("filename_match"):
                    if pattern_def["pattern"].match(filename):
                        findings.append({
                            "type": "secret_exposure",
                            "title": pattern_def["type"],
                            "severity": pattern_def["severity"],
                            "description": pattern_def["description"],
                            "file": relative_path,
                            "line": None,
                            "value_preview": None,
                            "recommendation": "Review and secure exposed secret."
                        })

            # Read file content for pattern matching
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
            except (OSError, PermissionError):
                continue

            for line_number, line in enumerate(lines, start=1):
                line_stripped = line.strip()
                if not line_stripped or line_stripped.startswith("#"):
                    continue

                for pattern_def in SECRET_PATTERNS:
                    if pattern_def.get("filename_match"):
                        continue
                    match = pattern_def["pattern"].search(line)
                    if match:
                        # Extract matched value preview
                        matched_value = match.group(0)
                        masked = _mask_value(matched_value)

                        # Avoid duplicate entries for same file+line+type
                        already_found = any(
                            f["file"] == relative_path and
                            f["line"] == line_number and
                            f["type"] == pattern_def["type"]
                            for f in findings
                        )
                        if not already_found:
                            findings.append({
                                "type": "secret_exposure",
                                "title": pattern_def["type"],
                                "severity": pattern_def["severity"],
                                "description": pattern_def["description"],
                                "file": relative_path,
                                "line": line_number,
                                "value_preview": masked,
                                "recommendation": "Review and secure exposed secret."
                            })

    # Determine risk level
    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for f in findings:
        sev = f.get("severity", "low")
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

    if severity_counts["critical"] > 0:
        risk_level = "critical"
    elif severity_counts["high"] > 0:
        risk_level = "high"
    elif severity_counts["medium"] > 0:
        risk_level = "medium"
    else:
        risk_level = "low"

    is_safe = severity_counts["critical"] == 0
    blocked = severity_counts["critical"] > 2

    return {
        "scan_status": "completed",
        "is_safe": is_safe,
        "risk_level": risk_level,
        "total_findings": len(findings),
        "blocked_deployment": blocked,
        "severity_summary": severity_counts,
        "findings": findings,
        "recommendations": _generate_security_recommendations(findings),
    }


def _generate_security_recommendations(findings: List[Dict]) -> List[str]:
    recommendations = []
    types_found = {f["type"] for f in findings}

    if any("AWS" in t for t in types_found):
        recommendations.append("Rotate all AWS credentials immediately via IAM console.")
    if any("GitHub" in t for t in types_found):
        recommendations.append("Revoke and regenerate all GitHub tokens in Developer Settings.")
    if any("Database" in t for t in types_found):
        recommendations.append("Move database URLs to environment variables and never commit them.")
    if ".env File" in types_found:
        recommendations.append("Add .env to .gitignore and use .env.example for documentation.")
    if any("API Key" in t or "API key" in t for t in types_found):
        recommendations.append("Store all API keys in environment variables or a secrets manager (e.g., HashiCorp Vault).")
    if any("Private Key" in t for t in types_found):
        recommendations.append("Never commit private keys. Use certificate management services.")
    if any("Password" in t for t in types_found):
        recommendations.append("Remove hardcoded passwords. Use hashed passwords and env variables.")

    if not recommendations:
        recommendations.append("No critical secrets found. Continue with deployment.")

    return recommendations
