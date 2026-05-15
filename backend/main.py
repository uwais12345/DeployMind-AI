# pyrefly: ignore [missing-import]
from fastapi import FastAPI, Request
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.responses import JSONResponse
import os, time
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="DeployMind AI",
    description="Enterprise AI-powered deployment platform API",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ────────────────────────────────────────────
# CORS
# ────────────────────────────────────────────
ALLOWED_ORIGINS = [
    os.getenv("FRONTEND_URL", "http://localhost:5173"),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4173",   # Vite preview
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
)

# ────────────────────────────────────────────
# REQUEST TIMING MIDDLEWARE
# ────────────────────────────────────────────
@app.middleware("http")
async def add_process_time(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start
    response.headers["X-Process-Time"] = f"{duration:.4f}s"
    return response

# ────────────────────────────────────────────
# DATABASE STARTUP
# ────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    try:
        from database import engine, Base
        import models  # noqa: ensure all models are registered
        Base.metadata.create_all(bind=engine)
        print("[DeployMind AI] Database tables initialized.")
    except Exception as e:
        print(f"[DeployMind AI] DB init warning: {e}")

# ────────────────────────────────────────────
# ROUTERS
# ────────────────────────────────────────────
from routers import users, projects, deployments, audit, versions, previews, websocket, github

app.include_router(users.router,       prefix="/api/users",       tags=["Authentication"])
app.include_router(projects.router,    prefix="/api/projects",    tags=["Projects"])
app.include_router(deployments.router, prefix="/api/deployments", tags=["Deployments"])
app.include_router(audit.router,       prefix="/api/audit",       tags=["Audit Logs"])
app.include_router(versions.router,    prefix="/api/versions",    tags=["Version History"])
app.include_router(previews.router,    prefix="/api/previews",    tags=["Preview Deployments"])
app.include_router(websocket.router,   prefix="/ws",              tags=["WebSocket"])
app.include_router(github.router,      prefix="/api/github",      tags=["GitHub"])

# ────────────────────────────────────────────
# HEALTH & ROOT
# ────────────────────────────────────────────
@app.get("/", tags=["System"])
async def root():
    return {
        "service": "DeployMind AI API",
        "version": "2.0.0",
        "status": "healthy",
        "docs": "/api/docs",
    }


@app.get("/health", tags=["System"])
async def health():
    return {"status": "healthy", "timestamp": time.time()}


# ────────────────────────────────────────────
# GLOBAL EXCEPTION HANDLER
# ────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__},
    )
