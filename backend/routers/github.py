from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import requests, os

import models, auth, database

router = APIRouter()

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")


@router.get("/status")
def github_status(
    current_user: models.User = Depends(auth.get_current_user),
):
    connected = bool(current_user.github_id or GITHUB_TOKEN)
    return {
        "connected": connected,
        "github_username": current_user.github_username,
        "github_id": current_user.github_id,
    }


@router.get("/oauth/url")
def get_oauth_url():
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=400, detail="GitHub OAuth not configured")
    scope = "repo,user:email"
    url = f"https://github.com/login/oauth/authorize?client_id={GITHUB_CLIENT_ID}&scope={scope}"
    return {"url": url}


@router.get("/oauth/callback")
def github_oauth_callback(
    code: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="GitHub OAuth not configured")

    # Exchange code for token
    token_resp = requests.post(
        "https://github.com/login/oauth/access_token",
        data={
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code,
        },
        headers={"Accept": "application/json"},
    )
    token_data = token_resp.json()
    access_token = token_data.get("access_token")

    if not access_token:
        raise HTTPException(status_code=400, detail="Failed to obtain GitHub access token")

    # Fetch GitHub user info
    user_resp = requests.get(
        "https://api.github.com/user",
        headers={
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json",
        },
    )
    if user_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch GitHub user info")

    github_user = user_resp.json()

    # Update user record
    current_user.github_id = str(github_user["id"])
    current_user.github_username = github_user.get("login")
    current_user.github_access_token = access_token
    current_user.avatar_url = github_user.get("avatar_url")
    db.commit()

    return {
        "message": "GitHub connected successfully",
        "github_username": github_user.get("login"),
        "avatar_url": github_user.get("avatar_url"),
    }


@router.post("/push/{project_id}")
def push_to_github(
    project_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.extracted_path or not os.path.exists(project.extracted_path):
        raise HTTPException(status_code=400, detail="Project files unavailable")

    from services.github_service import create_github_repo, push_to_github

    repo_name = project.name.lower().replace(" ", "-").replace("_", "-")

    # Create repo
    repo_result = create_github_repo(repo_name, private=True, description=f"Deployed via DeployMind AI")
    if not repo_result.get("success"):
        raise HTTPException(status_code=400, detail=repo_result.get("error", "GitHub repo creation failed"))

    clone_url = repo_result["clone_url"]

    # Push code
    push_result = push_to_github(project.extracted_path, clone_url)
    if not push_result.get("success"):
        raise HTTPException(status_code=400, detail=push_result.get("error", "Git push failed"))

    # Update project
    project.repository_url = repo_result["html_url"]
    project.github_repo_name = repo_result["full_name"]
    db.commit()

    return {
        "message": "Code pushed to GitHub",
        "repo_url": repo_result["html_url"],
        "full_name": repo_result["full_name"],
        "branch": push_result.get("branch", "main"),
    }
