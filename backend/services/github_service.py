"""
GitHub Integration Service
Creates repositories, initializes git, commits, pushes code via GitHub API + GitPython.
"""

import os
import requests
from typing import Dict, Any, Optional

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_API_BASE = "https://api.github.com"


def _headers() -> Dict[str, str]:
    return {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
    }


def create_github_repo(repo_name: str, private: bool = True, description: str = "") -> Dict[str, Any]:
    """Create a new GitHub repository via API."""
    if not GITHUB_TOKEN:
        return {"success": False, "error": "GITHUB_TOKEN not configured"}

    payload = {
        "name": repo_name,
        "description": description or f"Deployed via DeployMind AI",
        "private": private,
        "auto_init": False,
    }

    resp = requests.post(f"{GITHUB_API_BASE}/user/repos", json=payload, headers=_headers())

    if resp.status_code == 201:
        data = resp.json()
        return {
            "success": True,
            "repo_name": data["name"],
            "full_name": data["full_name"],
            "clone_url": data["clone_url"],
            "html_url": data["html_url"],
            "ssh_url": data["ssh_url"],
        }
    elif resp.status_code == 422:
        # Repo already exists, fetch it
        user = get_github_user()
        if user:
            fetch_resp = requests.get(f"{GITHUB_API_BASE}/repos/{user['login']}/{repo_name}", headers=_headers())
            if fetch_resp.status_code == 200:
                data = fetch_resp.json()
                return {
                    "success": True,
                    "repo_name": data["name"],
                    "full_name": data["full_name"],
                    "clone_url": data["clone_url"],
                    "html_url": data["html_url"],
                    "ssh_url": data["ssh_url"],
                }
        return {
            "success": False,
            "error": "Repository already exists and could not be retrieved",
            "detail": resp.json(),
        }
    else:
        return {
            "success": False,
            "error": f"GitHub API error: {resp.status_code}",
            "detail": resp.json(),
        }



def push_to_github(project_path: str, repo_clone_url: str, commit_message: str = "Initial commit by DeployMind AI") -> Dict[str, Any]:
    """Initialize git repo, add all files, commit, and push to GitHub."""
    try:
        from git import Repo, GitCommandError

        # Build authenticated URL
        if GITHUB_TOKEN and "github.com" in repo_clone_url:
            auth_url = repo_clone_url.replace("https://", f"https://{GITHUB_TOKEN}@")
        else:
            auth_url = repo_clone_url

        # Init repo
        repo = Repo.init(project_path)
        repo.git.add(A=True)

        # Commit
        if repo.is_dirty(untracked_files=True):
            repo.index.commit(commit_message)

        # Push
        if "origin" in [r.name for r in repo.remotes]:
            origin = repo.remotes.origin
            origin.set_url(auth_url)
        else:
            origin = repo.create_remote("origin", auth_url)

        # Try main branch first, then master
        try:
            repo.git.branch("-M", "main")
            origin.push(refspec="main:main", force=True)
            branch = "main"
        except GitCommandError:
            origin.push(refspec="master:master", force=True)
            branch = "master"

        return {
            "success": True,
            "branch": branch,
            "commit": repo.head.commit.hexsha[:8],
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_github_user() -> Optional[Dict[str, Any]]:
    """Fetch authenticated GitHub user info."""
    if not GITHUB_TOKEN:
        return None
    resp = requests.get(f"{GITHUB_API_BASE}/user", headers=_headers())
    if resp.status_code == 200:
        return resp.json()
    return None


def delete_github_repo(full_name: str) -> bool:
    """Delete a GitHub repository."""
    if not GITHUB_TOKEN:
        return False
    resp = requests.delete(f"{GITHUB_API_BASE}/repos/{full_name}", headers=_headers())
    return resp.status_code == 204
