"""
AI Service — Groq-powered analysis engine
Handles: deployment readiness, code review, build error fix, fix-my-project
"""

import os
import json
import logging
from groq import Groq
from dotenv import load_dotenv
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field, ValidationError

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama3-8b-8192"

logger = logging.getLogger(__name__)

# --- Pydantic Models for Strict Validation ---
class AIChecks(BaseModel):
    has_dockerfile: bool = False
    has_env_example: bool = False
    has_readme: bool = False
    dependency_health: str = "unknown"
    framework_compatibility: str = "unknown"

class AIAnalysisResponse(BaseModel):
    score: float = Field(default=50.0, ge=0.0, le=100.0)
    issues: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    summary: str = "Analysis completed with fallbacks."
    checks: AIChecks = Field(default_factory=AIChecks)

class CodeIssue(BaseModel):
    severity: str = "info"
    description: str = "Unknown issue"
    recommendation: str = "No recommendation"

class CodeReviewResponse(BaseModel):
    overall_quality_score: float = Field(default=50.0, ge=0.0, le=100.0)
    total_issues: int = 0
    critical_count: int = 0
    warning_count: int = 0
    info_count: int = 0
    security_issues: List[CodeIssue] = Field(default_factory=list)
    code_smells: List[CodeIssue] = Field(default_factory=list)
    performance_issues: List[CodeIssue] = Field(default_factory=list)
    architecture_issues: List[CodeIssue] = Field(default_factory=list)
    dependency_issues: List[CodeIssue] = Field(default_factory=list)
    summary: str = "Code review completed with fallbacks."


def _call_groq(prompt: str, system: str = "", max_tokens: int = 2048) -> tuple[Optional[Dict], Optional[str]]:
    """Returns (parsed_json_dict, raw_string)"""
    try:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        resp = client.chat.completions.create(
            messages=messages,
            model=MODEL,
            response_format={"type": "json_object"},
            max_tokens=max_tokens,
        )
        raw_content = resp.choices[0].message.content
        return json.loads(raw_content), raw_content
    except Exception as e:
        logger.error(f"[AI Service] Groq call failed: {e}")
        return None, None


def _build_file_tree(extracted_dir: str, max_lines: int = 150) -> str:
    lines = []
    for root, dirs, files in os.walk(extracted_dir):
        dirs[:] = [d for d in dirs if d not in {"node_modules", ".git", "__pycache__", "venv", "dist", "build"}]
        level = root.replace(extracted_dir, "").count(os.sep)
        indent = "  " * level
        lines.append(f"{indent}{os.path.basename(root)}/")
        for f in files:
            lines.append(f"{indent}  {f}")
        if len(lines) > max_lines:
            lines.append("  ... (truncated)")
            break
    return "\n".join(lines)


def analyze_project(extracted_dir: str, framework: str) -> tuple[Dict[str, Any], str]:
    """Returns (validated_dict, raw_json_string)"""
    fallback = AIAnalysisResponse().model_dump()
    if not os.getenv("GROQ_API_KEY"):
        return {"score": 50, "issues": ["Groq API key not configured."], "recommendations": [], "summary": "AI skipped.", "checks": fallback["checks"]}, "{}"

    tree = _build_file_tree(extracted_dir)
    prompt = f"""
You are a senior DevOps engineer analyzing a {framework} project for deployment readiness.

Project Structure:
{tree}

Respond with valid JSON:
{{
  "score": <number 0-100>,
  "issues": ["<issue1>", "<issue2>"],
  "recommendations": ["<rec1>", "<rec2>"],
  "summary": "<2-3 sentence summary>",
  "checks": {{
    "has_dockerfile": <bool>,
    "has_env_example": <bool>,
    "has_readme": <bool>,
    "dependency_health": "<good|fair|poor>",
    "framework_compatibility": "<good|fair|poor>"
  }}
}}
"""
    result_dict, raw_str = _call_groq(prompt)
    if not result_dict:
        fallback["issues"] = ["AI analysis failed due to API error."]
        fallback["summary"] = "Analysis error."
        return fallback, raw_str or "{}"

    try:
        validated = AIAnalysisResponse(**result_dict)
        return validated.model_dump(), raw_str
    except ValidationError as e:
        logger.error(f"[AI Service] Validation error for AIAnalysisResponse: {e}")
        fallback["issues"] = ["Failed to parse AI response. Using fallback data."]
        fallback["summary"] = "Validation error."
        return fallback, raw_str


def run_code_review(extracted_dir: str, framework: str) -> tuple[Dict[str, Any], str]:
    fallback = CodeReviewResponse().model_dump()
    if not os.getenv("GROQ_API_KEY"):
        fallback["summary"] = "AI skipped."
        return fallback, "{}"

    tree = _build_file_tree(extracted_dir, max_lines=100)

    # Gather sample of source files
    samples = []
    for root, dirs, files in os.walk(extracted_dir):
        dirs[:] = [d for d in dirs if d not in {"node_modules", ".git", "__pycache__", "venv", "dist"}]
        for f in files:
            if f.endswith((".js", ".jsx", ".ts", ".tsx", ".py")) and len(samples) < 5:
                fpath = os.path.join(root, f)
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as fp:
                        content = fp.read(1500)
                    samples.append(f"### {f}\n```\n{content}\n```")
                except Exception:
                    pass

    sample_str = "\n\n".join(samples[:3])

    prompt = f"""
You are a staff engineer conducting a code review for a {framework} project.

Project structure:
{tree}

Sample source files:
{sample_str}

Respond with valid JSON:
{{
  "overall_quality_score": <number 0-100>,
  "total_issues": <number>,
  "critical_count": <number>,
  "warning_count": <number>,
  "info_count": <number>,
  "security_issues": [
    {{"severity": "critical|high|medium", "description": "<desc>", "recommendation": "<fix>"}}
  ],
  "code_smells": [
    {{"severity": "warning|info", "description": "<desc>", "recommendation": "<fix>"}}
  ],
  "performance_issues": [
    {{"severity": "warning|info", "description": "<desc>", "recommendation": "<fix>"}}
  ],
  "architecture_issues": [
    {{"severity": "warning|info", "description": "<desc>", "recommendation": "<fix>"}}
  ],
  "dependency_issues": [
    {{"severity": "high|medium|low", "description": "<desc>", "recommendation": "<fix>"}}
  ],
  "summary": "<2-3 sentence summary of code quality>"
}}
"""
    result_dict, raw_str = _call_groq(prompt, max_tokens=2500)
    if not result_dict:
        fallback["summary"] = "Code review failed due to API error."
        return fallback, raw_str or "{}"
        
    try:
        validated = CodeReviewResponse(**result_dict)
        return validated.model_dump(), raw_str
    except ValidationError as e:
        logger.error(f"[AI Service] Validation error for CodeReviewResponse: {e}")
        fallback["summary"] = "Validation error while parsing code review."
        return fallback, raw_str


def analyze_build_errors(logs: str, framework: str) -> tuple[Dict[str, Any], str]:
    if not os.getenv("GROQ_API_KEY"):
        return {"root_cause": "AI not available.", "fixes": [], "summary": ""}, "{}"

    prompt = f"""
You are a DevOps expert analyzing deployment build failure logs for a {framework} project.

Build Logs:
{logs[:3000]}

Respond with valid JSON:
{{
  "root_cause": "<short description of root cause>",
  "error_type": "dependency|syntax|env|framework|port|module|other",
  "severity": "blocking|warning",
  "fixes": [
    {{"step": 1, "action": "<beginner-friendly action>", "command": "<exact command if applicable>"}},
    {{"step": 2, "action": "<advanced fix>", "command": "<command>"}}
  ],
  "summary": "<2 sentence plain English explanation>"
}}
"""
    result_dict, raw_str = _call_groq(prompt)
    if not result_dict:
        return {"root_cause": "Analysis failed.", "fixes": [], "summary": ""}, raw_str or "{}"
    return result_dict, raw_str


def fix_my_project(extracted_dir: str, framework: str) -> tuple[Dict[str, Any], str]:
    if not os.getenv("GROQ_API_KEY"):
        return {"issues_found": [], "fixes_suggested": [], "summary": "AI skipped."}, "{}"

    tree = _build_file_tree(extracted_dir, max_lines=100)

    prompt = f"""
You are a deployment automation expert. Analyze this {framework} project and identify issues 
that would prevent successful deployment, then suggest concrete fixes.

Project structure:
{tree}

Respond with valid JSON:
{{
  "issues_found": [
    {{"category": "dependency|script|env|config|framework", "severity": "critical|high|medium|low", "description": "<issue>"}}
  ],
  "fixes_suggested": [
    {{"issue": "<issue ref>", "fix": "<exact fix>", "file": "<filename if applicable>", "auto_fixable": true|false}}
  ],
  "missing_files": ["<file1>", "<file2>"],
  "deployment_blockers": ["<blocker1>"],
  "summary": "<2-3 sentence assessment>"
}}
"""
    result_dict, raw_str = _call_groq(prompt)
    if not result_dict:
        return {"issues_found": [], "fixes_suggested": [], "summary": "Fix analysis failed."}, raw_str or "{}"
    return result_dict, raw_str
