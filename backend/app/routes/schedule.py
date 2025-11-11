# app/routers/schedule.py
from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.database import SessionLocal
from app.models_exam import Pruefungstag, Pruefung, Pruefkandidat
from app.schemas_exam import PruefungstagOut, SlotOut, PruefungDetailOut

router = APIRouter(prefix="/api", tags=["Schedule"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/pruefungstage", response_model=List[PruefungstagOut])
def list_pruefungstage(
    db: Session = Depends(get_db),
    ausschuss_id: Optional[int] = Query(None),
    von: Optional[date] = Query(None, description="Startdatum (inkl.)"),
    bis: Optional[date] = Query(None, description="Enddatum (inkl.)"),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    q = select(Pruefungstag)
    cond = []
    if ausschuss_id: cond.append(Pruefungstag.ausschuss_id == ausschuss_id)
    if von: cond.append(Pruefungstag.datum >= von)
    if bis: cond.append(Pruefungstag.datum <= bis)
    if status: cond.append(Pruefungstag.status == status)
    if cond: q = q.where(and_(*cond))
    q = q.order_by(Pruefungstag.datum.asc()).limit(limit).offset(offset)
    return db.execute(q).scalars().all()

@router.get("/pruefungstage/{pruefungstag_id}", response_model=PruefungstagOut)
def get_pruefungstag(pruefungstag_id: int, db: Session = Depends(get_db)):
    obj = db.get(Pruefungstag, pruefungstag_id)
    if not obj:
        raise HTTPException(404, "Pruefungstag nicht gefunden")
    return obj

@router.get("/pruefungstage/{pruefungstag_id}/pruefungen", response_model=List[SlotOut])
def list_slots(pruefungstag_id: int, db: Session = Depends(get_db)):
    q = (
        select(
            Pruefung.pruefung_id,
            Pruefung.pruefkandidat_id,
            (Pruefkandidat.nachname + ", " + Pruefkandidat.vorname).label("kandidat_name"),
            Pruefung.start_at,
            Pruefung.end_at,
            Pruefung.teil1_art,
            Pruefung.status,
            Pruefung.theorie_punkte,
            Pruefung.theorie_note,
        )
        .join(Pruefkandidat, Pruefkandidat.pruefkandidat_id == Pruefung.pruefkandidat_id)
        .where(Pruefung.pruefungstag_id == pruefungstag_id)
        .order_by(Pruefung.start_at.is_(None).desc(), Pruefung.start_at.asc(), Pruefung.pruefung_id.asc())
    )
    rows = db.execute(q).all()
    return [SlotOut(**dict(r._mapping)) for r in rows]

@router.get("/pruefungen/{pruefung_id}", response_model=PruefungDetailOut)
def get_slot(pruefung_id: int, db: Session = Depends(get_db)):
    q = (
        select(
            Pruefung.pruefung_id,
            Pruenung.pruefungstag_id,          # typo avoided in final!
            Pruefung.pruefkandidat_id,
            (Pruefkandidat.nachname + ", " + Pruefkandidat.vorname).label("kandidat_name"),
            Pruefung.start_at,
            Pruefung.end_at,
            Pruefung.teil1_art,
            Pruefung.status,
            Pruefung.theorie_punkte,
            Pruefung.theorie_note,
        )
        .join(Pruefkandidat, Pruefkandidat.pruefkandidat_id == Pruefung.pruefkandidat_id)
        .where(Pruefung.pruefung_id == pruefung_id)
    )
    row = db.execute(q).first()
    if not row:
        raise HTTPException(404, "Pruefung/Slot nicht gefunden")
    return PruefungDetailOut(**dict(row._mapping))
