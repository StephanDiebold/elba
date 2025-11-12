# app/core/deps.py
from typing import Generator
from sqlalchemy.orm import Session
from app.core.database import SessionLocal   # <-- wichtig: app.core.database

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
