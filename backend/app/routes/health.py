# app/routes/health.py
from fastapi import APIRouter
from sqlalchemy import text
from app.core.database import SessionLocal
from app.core.settings import ENV

router = APIRouter(tags=["Health"])

@router.get("/healthz")
def healthz():
    # einfacher Liveness-Ping
    return {"status": "ok", "env": ENV}

@router.get("/readyz")
def readyz():
    # Readiness: DB kurz pingen
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return {"ready": True}
    except Exception as exc:
        # bewusst knapp – keine internen Details leaken
        return {"ready": False, "error": str(type(exc).__name__)}

@router.get("/version")
def version():
    # optional: aus ENV GIT_SHA / BUILD_TAG anzeigen
    import os
    return {
        "app": "elba-backend",
        "version": os.getenv("APP_VERSION", "0.0.0"),
        "git_sha": os.getenv("GIT_SHA", ""),
        "env": ENV,
    }
