from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from datetime import datetime, timedelta
from typing import Any, Dict
import models, auth, database
from services.ai_service import generate_deployment_insights

_insights_cache: Dict[int, Any] = {}  # {user_id: {"ts": datetime, "data": list}}
INSIGHTS_TTL_MINUTES = 5

router = APIRouter()

@router.get("/")
def get_analytics(
    days: int = 7,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    # 1. Fetch User's Projects
    projects = db.query(models.Project).filter(models.Project.owner_id == current_user.id).all()
    project_ids = [p.id for p in projects]
    
    if not project_ids:
        return {
            "health": {"total": 0, "success_rate": 0, "failure_rate": 0, "avg_duration": 0, "active": 0},
            "trends": [],
            "frameworks": [],
            "ai_metrics": {"avg_score": 0, "total_security_issues": 0},
            "failures": []
        }

    # 2. Deployment Health
    deployments = db.query(models.Deployment).filter(models.Deployment.project_id.in_(project_ids)).all()
    total_deployments = len(deployments)
    completed = [d for d in deployments if d.status == "completed"]
    failed = [d for d in deployments if d.status == "failed"]
    active = [d for d in deployments if d.status not in ["completed", "failed", "cancelled"]]
    
    success_rate = round((len(completed) / total_deployments * 100)) if total_deployments else 0
    failure_rate = round((len(failed) / total_deployments * 100)) if total_deployments else 0
    
    durations = [d.build_duration_seconds for d in completed if d.build_duration_seconds]
    avg_duration = round(sum(durations) / len(durations)) if durations else 0

    # 3. Deployment Trends (Dynamic days)
    start_date = datetime.utcnow() - timedelta(days=days)
    recent_deployments = [d for d in deployments if d.created_at >= start_date]
    
    trends_map = {}
    for i in range(days + 1):
        date_str = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        trends_map[date_str] = {"date": date_str, "success": 0, "failed": 0, "total": 0}
        
    for d in recent_deployments:
        date_str = d.created_at.strftime("%Y-%m-%d")
        if date_str in trends_map:
            trends_map[date_str]["total"] += 1
            if d.status == "completed":
                trends_map[date_str]["success"] += 1
            elif d.status == "failed":
                trends_map[date_str]["failed"] += 1
                
    trends = list(trends_map.values())

    # 4. Framework Analytics
    frameworks_map = {}
    for p in projects:
        fw = p.framework or "Unknown"
        if fw not in frameworks_map:
            frameworks_map[fw] = {"name": fw, "count": 0, "success": 0, "total": 0}
        frameworks_map[fw]["count"] += 1
        
    for d in deployments:
        p = next((p for p in projects if p.id == d.project_id), None)
        if p:
            fw = p.framework or "Unknown"
            frameworks_map[fw]["total"] += 1
            if d.status == "completed":
                frameworks_map[fw]["success"] += 1
                
    frameworks_list = []
    for fw, data in frameworks_map.items():
        rate = round((data["success"] / data["total"] * 100)) if data["total"] else 0
        frameworks_list.append({"name": fw, "projects": data["count"], "success_rate": rate})

    # 5. AI Analysis Metrics
    scores = [p.readiness_score for p in projects if p.readiness_score is not None]
    avg_score = round(sum(scores) / len(scores)) if scores else 0
    
    total_sec_issues = 0
    for p in projects:
        if p.security_scan and isinstance(p.security_scan, dict):
            total_sec_issues += p.security_scan.get("total_findings", 0)

    # 6. Failure Intelligence
    failure_reasons = {}
    for d in failed:
        reason = d.error_message or "Unknown Error"
        # Simplify reason for charting
        if "timeout" in reason.lower(): reason = "Timeout"
        elif "build" in reason.lower() or "compile" in reason.lower(): reason = "Build Failure"
        elif "dependenc" in reason.lower() or "npm" in reason.lower(): reason = "Dependency Error"
        elif "unauthorized" in reason.lower() or "secret" in reason.lower(): reason = "Auth/Secret Error"
        else: reason = "Other"
        
        failure_reasons[reason] = failure_reasons.get(reason, 0) + 1
        
    failures_list = [{"reason": k, "count": v} for k, v in failure_reasons.items()]

    # 7. Provider Distribution
    provider_map = {}
    for d in deployments:
        p_name = d.provider or "unknown"
        if p_name not in provider_map:
            provider_map[p_name] = {"name": p_name, "count": 0, "success": 0, "avg_duration": 0, "durations": []}
        
        pm = provider_map[p_name]
        pm["count"] += 1
        if d.status == "completed":
            pm["success"] += 1
            if d.build_duration_seconds:
                pm["durations"].append(d.build_duration_seconds)

    provider_stats = []
    for p_name, data in provider_map.items():
        avg = round(sum(data["durations"]) / len(data["durations"])) if data["durations"] else 0
        rate = round((data["success"] / data["count"] * 100)) if data["count"] else 0
        provider_stats.append({
            "name": p_name,
            "count": data["count"],
            "success_rate": rate,
            "avg_duration": avg
        })

    return {
        "health": {
            "total": total_deployments,
            "success_rate": success_rate,
            "failure_rate": failure_rate,
            "avg_duration": avg_duration,
            "active": len(active)
        },
        "trends": trends,
        "frameworks": frameworks_list,
        "providers": provider_stats,
        "ai_metrics": {
            "avg_score": avg_score,
            "total_security_issues": total_sec_issues
        },
        "failures": failures_list,
        "total_projects": len(projects),
        "total_deployments": total_deployments,
        "success_rate": success_rate,
    }


@router.get("/insights")
def get_insights(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    """
    Returns AI-generated operational insights.
    Cached per-user for 5 minutes to avoid redundant Groq calls.
    """
    uid = current_user.id
    cached = _insights_cache.get(uid)
    if cached and (datetime.utcnow() - cached["ts"]) < timedelta(minutes=INSIGHTS_TTL_MINUTES):
        return {"insights": cached["data"], "cached": True}

    # Build analytics snapshot
    projects = db.query(models.Project).filter(models.Project.owner_id == uid).all()
    project_ids = [p.id for p in projects]
    deployments = db.query(models.Deployment).filter(
        models.Deployment.project_id.in_(project_ids)
    ).all() if project_ids else []

    total = len(deployments)
    success = sum(1 for d in deployments if d.status == "completed")
    failed_list = [d for d in deployments if d.status == "failed"]
    durations = [d.build_duration_seconds for d in deployments if d.status == "completed" and d.build_duration_seconds]

    # Provider stats
    provider_map: Dict[str, Any] = {}
    for d in deployments:
        pn = d.provider or "unknown"
        if pn not in provider_map:
            provider_map[pn] = {"name": pn, "count": 0, "success": 0, "durations": []}
        provider_map[pn]["count"] += 1
        if d.status == "completed":
            provider_map[pn]["success"] += 1
            if d.build_duration_seconds:
                provider_map[pn]["durations"].append(d.build_duration_seconds)

    provider_stats = []
    for pn, data in provider_map.items():
        avg = round(sum(data["durations"]) / len(data["durations"])) if data["durations"] else 0
        rate = round(data["success"] / data["count"] * 100) if data["count"] else 0
        provider_stats.append({"name": pn, "count": data["count"], "success_rate": rate, "avg_duration": avg})

    # Failure reasons
    failure_reasons: Dict[str, int] = {}
    for d in failed_list:
        reason = d.error_message or "Unknown"
        if "timeout" in reason.lower(): reason = "Timeout"
        elif "build" in reason.lower(): reason = "Build Failure"
        elif "dependenc" in reason.lower(): reason = "Dependency Error"
        elif "unauthorized" in reason.lower(): reason = "Auth/Token Error"
        else: reason = "Other"
        failure_reasons[reason] = failure_reasons.get(reason, 0) + 1

    analytics_snapshot = {
        "health": {
            "total": total,
            "success_rate": round(success / total * 100) if total else 0,
            "avg_duration": round(sum(durations) / len(durations)) if durations else 0,
        },
        "providers": provider_stats,
        "frameworks": [{"name": p.framework or "Unknown", "projects": 1, "success_rate": 0} for p in projects],
        "failures": [{"reason": k, "count": v} for k, v in failure_reasons.items()],
        "ai_metrics": {
            "avg_score": round(sum(p.readiness_score for p in projects if p.readiness_score) / len(projects)) if projects else 0
        },
    }

    insights = generate_deployment_insights(analytics_snapshot)
    _insights_cache[uid] = {"ts": datetime.utcnow(), "data": insights}
    return {"insights": insights, "cached": False}
