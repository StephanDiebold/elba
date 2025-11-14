# app/domains/common/stammdaten.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.deps import get_db
from app.domains.exam.models import Kammer, Bezirkskammer

router = APIRouter(prefix="/stammdaten", tags=["Stammdaten"])

@router.get("/kammer")
def list_kammer(db: Session = Depends(get_db)):
    return db.query(Kammer).order_by(Kammer.kammer_name).all()

@router.get("/bezirkskammer")
def list_bezirkskammer(
    db: Session = Depends(get_db),
    kammer_id: int | None = Query(None),   # <<< optional!
):
    q = db.query(Bezirkskammer)
    if kammer_id is not None:
        q = q.filter(Bezirkskammer.kammer_id == kammer_id)
    return q.order_by(Bezirkskammer.bezirkskammer_name).all()