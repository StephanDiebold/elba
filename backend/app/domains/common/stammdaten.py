# app/domains/common/stammdaten.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.deps import get_db

router = APIRouter(prefix="/stammdaten", tags=["Stammdaten"])

@router.get("/kammer")
def list_kammern(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT kammer_id, kammer_name
        FROM kammer
        ORDER BY kammer_name
    """)).mappings().all()
    return [dict(r) for r in rows]

@router.get("/bezirkskammer")
def list_bezirkskammern(
    kammer_id: int = Query(..., gt=0),
    db: Session = Depends(get_db),
):
    rows = db.execute(text("""
        SELECT bezirkskammer_id, kammer_id, bezirkskammer_name
        FROM bezirkskammer
        WHERE kammer_id = :kid
        ORDER BY bezirkskammer_name
    """), {"kid": kammer_id}).mappings().all()
    return [dict(r) for r in rows]
