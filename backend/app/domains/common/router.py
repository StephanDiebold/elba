# app/domains/common/router.py
from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.deps import get_db
from app.domains.exam._models import Ausschuss, Fachbereich

# WICHTIG: Präfix so wie von Frontend benutzt
router = APIRouter(prefix="/stammdaten", tags=["Stammdaten"])

# -------------------------------------------------------------------
# Fachbereiche
# -------------------------------------------------------------------

@router.get("/fachbereiche")
def list_fachbereiche(db: Session = Depends(get_db)):
    q = db.query(Fachbereich)
    # falls es eine Spalte "aktiv" gibt, nur aktive nehmen
    if hasattr(Fachbereich, "aktiv"):
        q = q.filter(Fachbereich.aktiv == True)
    rows = q.order_by(Fachbereich.fachbereich_name.asc()).all()
    return [
        {
            "fachbereich_id": f.fachbereich_id,
            "fachbereich_name": f.fachbereich_name,
        }
        for f in rows
    ]


# -------------------------------------------------------------------
# Ausschüsse (filterbar nach Fachbereich / Kammer / Bezirkskammer)
# -------------------------------------------------------------------

@router.get("/ausschuesse")
def list_ausschuesse(
    db: Session = Depends(get_db),
    fachbereich_id: Optional[int] = Query(None),
    kammer_id: Optional[int] = Query(None),
    bezirkskammer_id: Optional[int] = Query(None),
):
    q = db.query(Ausschuss)

    if fachbereich_id is not None and hasattr(Ausschuss, "fachbereich_id"):
        q = q.filter(Ausschuss.fachbereich_id == fachbereich_id)
    if kammer_id is not None and hasattr(Ausschuss, "kammer_id"):
        q = q.filter(Ausschuss.kammer_id == kammer_id)
    if bezirkskammer_id is not None and hasattr(Ausschuss, "bezirkskammer_id"):
        q = q.filter(Ausschuss.bezirkskammer_id == bezirkskammer_id)
    if hasattr(Ausschuss, "aktiv"):
        q = q.filter(Ausschuss.aktiv == True)

    rows = q.order_by(Ausschuss.ausschuss_name.asc()).all()
    return [
        {
            "ausschuss_id": a.ausschuss_id,
            "ausschuss_name": a.ausschuss_name,
        }
        for a in rows
    ]


# -------------------------------------------------------------------
# Kammern & Bezirkskammern
# (so wie sie bei dir schon funktionieren)
# -------------------------------------------------------------------

@router.get("/kammer")
def list_kammern(db: Session = Depends(get_db)):
    rows = (
        db.execute(
            text(
                """
                SELECT kammer_id, kammer_name
                FROM kammer
                ORDER BY kammer_name
                """
            )
        )
        .mappings()
        .all()
    )
    return [dict(r) for r in rows]


@router.get("/bezirkskammer")
def list_bezirkskammern(
    kammer_id: int = Query(..., gt=0),
    db: Session = Depends(get_db),
):
    rows = (
        db.execute(
            text(
                """
                SELECT bezirkskammer_id, kammer_id, bezirkskammer_name
                FROM bezirkskammer
                WHERE kammer_id = :kid
                ORDER BY bezirkskammer_name
                """
            ),
            {"kid": kammer_id},
        )
        .mappings()
        .all()
    )
    return [dict(r) for r in rows]
