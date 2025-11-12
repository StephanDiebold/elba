# app/main.py
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.settings import ALLOW_ORIGINS as ENV_ALLOW_ORIGINS, ALLOW_ORIGIN_REGEX
from app.core.database import engine, Base

# Router-Imports (bitte exakt diese Pfade nutzen)
from app.routes.health import router as health_router
from app.domains.common.stammdaten import router as stammdaten_router
from app.domains.exam.router import router as exam_router
from app.domains.auth.auth import router as auth_router

app = FastAPI(title="ELBA API", version="0.0.0")

# CORS
default_origins = [
    "https://elba-app.diebold.gmbh",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
allow_origins = list(dict.fromkeys([*ENV_ALLOW_ORIGINS, *default_origins]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=ALLOW_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin"],
    expose_headers=["X-Total-Count", "Content-Disposition"],
    max_age=86400,
)

@app.middleware("http")
async def add_expose_headers(request: Request, call_next):
    resp = await call_next(request)
    if "Access-Control-Expose-Headers" not in resp.headers:
        resp.headers["Access-Control-Expose-Headers"] = "X-Total-Count"
    return resp

# Nur in DEV Tabellen auto-erzeugen
if os.getenv("ENV", "dev") == "dev":
    Base.metadata.create_all(bind=engine)

# Router registrieren
app.include_router(health_router)
app.include_router(stammdaten_router)   # /stammdaten/...
app.include_router(exam_router)         # /api/exam/...
app.include_router(auth_router)         # /auth/...

@app.get("/")
def root():
    return {"message": "ELBA Backend läuft 🚀"}
