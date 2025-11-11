# backend/app/main.py
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .settings import ALLOW_ORIGINS as ENV_ALLOW_ORIGINS, ALLOW_ORIGIN_REGEX
from .database import engine, Base
from .routes import health, auth, stammdaten ,schedule

app = FastAPI(title="ELBA API", version="0.0.0")
app.include_router(auth.router)
app.include_router(stammdaten.router)
app.include_router(schedule.router, prefix="/schedule", tags=["schedule"])

# bekannte Defaults (lokal + prod)
default_origins = [
    "https://elba-app.diebold.gmbh",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# aus ENV (settings) + Defaults → Liste deduplizieren, Reihenfolge beibehalten
allow_origins = list(dict.fromkeys([*ENV_ALLOW_ORIGINS, *default_origins]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=ALLOW_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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

# Nur in DEV automatisch Tabellen anlegen (Prod über Migrationen)
if os.getenv("ENV", "dev") == "dev":
    Base.metadata.create_all(bind=engine)

# Router
app.include_router(health.router)
app.include_router(auth.router)

@app.get("/")
def root():
    return {"message": "ELBA Backend läuft 🚀"}
