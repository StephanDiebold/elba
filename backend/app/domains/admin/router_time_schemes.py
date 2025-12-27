# backend/app/domains/admin/router_time_schemes.py

from datetime import datetime, time as dtime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.deps import get_db
from app.domains.admin.models import TimeScheme, TimeSchemeDefault, OrganizationUnit
from app.domains.admin.schemas import (
    TimeSchemeCreate,
    TimeSchemeUpdate,
    TimeSchemeOut,
    TimeSchemeDefaultCreate,
    TimeSchemeDefaultUpdate,
    TimeSchemeDefaultOut,
    ResolvedTimeSchemeOut,
)

router = APIRouter(prefix="/admin", tags=["Administration – Time Schemes"])


# --------------------------------------------------
# Helpers
# --------------------------------------------------

def _parse_time(value: str) -> dtime:
    """
    Accepts 'HH:MM' or 'HH:MM:SS'
    """
    value = (value or "").strip()
    try:
        parts = value.split(":")
        if len(parts) == 2:
            h, m = int(parts[0]), int(parts[1])
            return dtime(hour=h, minute=m, second=0)
        if len(parts) == 3:
            h, m, s = int(parts[0]), int(parts[1]), int(parts[2])
            return dtime(hour=h, minute=m, second=s)
    except Exception:
        pass
    raise HTTPException(status_code=400, detail="default_first_slot_start muss 'HH:MM' oder 'HH:MM:SS' sein.")


def _get_time_scheme_or_404(db: Session, time_scheme_id: int) -> TimeScheme:
    obj = db.get(TimeScheme, time_scheme_id)
    if not obj:
        raise HTTPException(status_code=404, detail="TimeScheme nicht gefunden")
    return obj


def _get_time_scheme_default_or_404(db: Session, time_scheme_default_id: int) -> TimeSchemeDefault:
    obj = db.get(TimeSchemeDefault, time_scheme_default_id)
    if not obj:
        raise HTTPException(status_code=404, detail="TimeSchemeDefault nicht gefunden")
    return obj


def _resolve_time_scheme_id(db: Session, org_unit_id: int, subject_id: int) -> tuple[Optional[int], Optional[int]]:
    """
    Walk up org_unit hierarchy and find first active TimeSchemeDefault.
    Returns (time_scheme_id, resolved_from_org_unit_id)
    """
    current_id = org_unit_id
    visited = set()

    while current_id and current_id not in visited:
        visited.add(current_id)

        row = (
            db.query(TimeSchemeDefault)
            .filter(
                TimeSchemeDefault.org_unit_id == current_id,
                TimeSchemeDefault.subject_id == subject_id,
                TimeSchemeDefault.is_active == True,
            )
            .first()
        )
        if row:
            return row.time_scheme_id, current_id

        ou = db.get(OrganizationUnit, current_id)
        if not ou:
            break
        current_id = ou.parent_org_unit_id

    return None, None

# --------------------------------------------------
# Resolve helper endpoint
# --------------------------------------------------


@router.get("/time-schemes/resolve", response_model=ResolvedTimeSchemeOut)
def resolve_time_scheme(org_unit_id: int = Query(...), subject_id: int = Query(...), db: Session = Depends(get_db)):
    ts_id, from_ou_id = _resolve_time_scheme_id(db, org_unit_id, subject_id)
    return ResolvedTimeSchemeOut(
        org_unit_id=org_unit_id,
        subject_id=subject_id,
        resolved_time_scheme_id=ts_id,
        resolved_from_org_unit_id=from_ou_id,
    )

# --------------------------------------------------
# TimeSchemes
# --------------------------------------------------

@router.get("/time-schemes", response_model=list[TimeSchemeOut])
def list_time_schemes(
    db: Session = Depends(get_db),
    is_active: bool | None = Query(None),
    search: str | None = Query(None),
):
    q = db.query(TimeScheme)
    if is_active is not None:
        q = q.filter(TimeScheme.is_active == is_active)
    if search:
        like = f"%{search}%"
        q = q.filter(TimeScheme.name.ilike(like))
    return q.order_by(TimeScheme.name.asc()).all()


@router.get("/time-schemes/{time_scheme_id:int}", response_model=TimeSchemeOut)
def get_time_scheme(time_scheme_id: int, db: Session = Depends(get_db)):
    return _get_time_scheme_or_404(db, time_scheme_id)

@router.post("/time-schemes", response_model=TimeSchemeOut, status_code=201)
def create_time_scheme(payload: TimeSchemeCreate, db: Session = Depends(get_db)):
    obj = TimeScheme(
        name=payload.name,
        default_first_slot_start=_parse_time(payload.default_first_slot_start),
        exam_duration_minutes=payload.exam_duration_minutes,
        discussion_buffer_minutes=payload.discussion_buffer_minutes,
        max_slots=payload.max_slots,
        lunch_after_slots=payload.lunch_after_slots,
        lunch_break_duration_minutes=payload.lunch_break_duration_minutes,
        is_active=payload.is_active,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/time-schemes/{time_scheme_id}", response_model=TimeSchemeOut)
def update_time_scheme(time_scheme_id: int, payload: TimeSchemeUpdate, db: Session = Depends(get_db)):
    obj = _get_time_scheme_or_404(db, time_scheme_id)

    data = payload.model_dump(exclude_unset=True)
    if "default_first_slot_start" in data:
        obj.default_first_slot_start = _parse_time(data.pop("default_first_slot_start"))

    for k, v in data.items():
        setattr(obj, k, v)

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/time-schemes/{time_scheme_id}")
def delete_time_scheme(time_scheme_id: int, db: Session = Depends(get_db)):
    obj = _get_time_scheme_or_404(db, time_scheme_id)
    # Soft-delete ist hier sinnvoller (Slots/ExamDay referenzieren evtl. historisch)
    obj.is_active = False
    db.add(obj)
    db.commit()
    return {"ok": True, "time_scheme_id": time_scheme_id}


# --------------------------------------------------
# TimeSchemeDefaults (OrgUnit + Subject)
# --------------------------------------------------

@router.get("/time-scheme-defaults", response_model=list[TimeSchemeDefaultOut])
def list_time_scheme_defaults(
    db: Session = Depends(get_db),
    org_unit_id: int | None = Query(None),
    subject_id: int | None = Query(None),
    is_active: bool | None = Query(None),
):
    q = db.query(TimeSchemeDefault)
    if org_unit_id is not None:
        q = q.filter(TimeSchemeDefault.org_unit_id == org_unit_id)
    if subject_id is not None:
        q = q.filter(TimeSchemeDefault.subject_id == subject_id)
    if is_active is not None:
        q = q.filter(TimeSchemeDefault.is_active == is_active)

    return q.order_by(TimeSchemeDefault.org_unit_id.asc(), TimeSchemeDefault.subject_id.asc()).all()


@router.post("/time-scheme-defaults", response_model=TimeSchemeDefaultOut, status_code=201)
def create_time_scheme_default(payload: TimeSchemeDefaultCreate, db: Session = Depends(get_db)):
    obj = TimeSchemeDefault(**payload.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Für diese Kombination (org_unit_id, subject_id) existiert bereits ein Default (Unique Constraint).",
        )
    db.refresh(obj)
    return obj


@router.patch("/time-scheme-defaults/{time_scheme_default_id}", response_model=TimeSchemeDefaultOut)
def update_time_scheme_default(
    time_scheme_default_id: int,
    payload: TimeSchemeDefaultUpdate,
    db: Session = Depends(get_db),
):
    obj = _get_time_scheme_default_or_404(db, time_scheme_default_id)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)

    db.add(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Update würde Unique Constraint verletzen (org_unit_id, subject_id).",
        )

    db.refresh(obj)
    return obj


@router.delete("/time-scheme-defaults/{time_scheme_default_id}")
def delete_time_scheme_default(time_scheme_default_id: int, db: Session = Depends(get_db)):
    obj = _get_time_scheme_default_or_404(db, time_scheme_default_id)
    obj.is_active = False
    db.add(obj)
    db.commit()
    return {"ok": True, "time_scheme_default_id": time_scheme_default_id}

# End of router_time_schemes.py
