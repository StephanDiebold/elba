# app/domains/admin/router_org_units.py
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.deps import get_db
from app.domains.admin.models import OrganizationUnit
from app.domains.admin.schemas import (
    OrgUnitOut,
    OrgUnitCreate,
    OrgUnitUpdate,
    OrgUnitType,
)

router = APIRouter(prefix="/admin", tags=["Administration – Org Units"])


def _get_org_unit_or_404(db: Session, org_unit_id: int) -> OrganizationUnit:
    ou = db.get(OrganizationUnit, org_unit_id)
    if not ou:
        raise HTTPException(status_code=404, detail="Organisationseinheit nicht gefunden")
    return ou


# -----------------------------------------------------------
# LIST
# -----------------------------------------------------------

@router.get("/org-units", response_model=list[OrgUnitOut])
def list_org_units(
    db: Session = Depends(get_db),
    type: Optional[OrgUnitType] = Query(
        None, description="Filter nach Typ: chamber | district_chamber"
    ),
    is_active: Optional[bool] = Query(
        None, description="Nur aktive/inaktive Einträge"
    ),
    search: Optional[str] = Query(
        None, description="Volltextsuche auf name / code"
    ),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
):
    q = db.query(OrganizationUnit)

    if type:
        q = q.filter(OrganizationUnit.type == type)
    if is_active is not None:
        q = q.filter(OrganizationUnit.is_active == is_active)
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(
                OrganizationUnit.name.ilike(like),
                OrganizationUnit.code.ilike(like),
            )
        )

    q = q.order_by(OrganizationUnit.type.asc(), OrganizationUnit.name.asc())
    items = q.offset((page - 1) * size).limit(size).all()
    return items


# -----------------------------------------------------------
# GET SINGLE
# -----------------------------------------------------------

@router.get("/org-units/{org_unit_id}", response_model=OrgUnitOut)
def get_org_unit(org_unit_id: int, db: Session = Depends(get_db)):
    return _get_org_unit_or_404(db, org_unit_id)


# -----------------------------------------------------------
# CREATE
# -----------------------------------------------------------

@router.post("/org-units", response_model=OrgUnitOut, status_code=201)
def create_org_unit(payload: OrgUnitCreate, db: Session = Depends(get_db)):
    ou = OrganizationUnit(**payload.model_dump())
    db.add(ou)
    db.commit()
    db.refresh(ou)
    return ou


# -----------------------------------------------------------
# UPDATE (PUT = vollständiges Ersetzen)
# -----------------------------------------------------------

@router.put(
    "/org-units/{org_unit_id}",
    response_model=OrgUnitOut,
    summary="Replace Org Unit",
    description="Ersetzt die Organisationseinheit vollständig. Alle Felder müssen gesetzt werden."
)
def replace_org_unit(
    org_unit_id: int,
    payload: OrgUnitCreate,    # ⬅️ Vollständiges Schema!
    db: Session = Depends(get_db),
):
    ou = _get_org_unit_or_404(db, org_unit_id)

    data = payload.model_dump()
    for key, value in data.items():
        setattr(ou, key, value)

    db.add(ou)
    db.commit()
    db.refresh(ou)
    return ou


# -----------------------------------------------------------
# PARTIAL UPDATE (PATCH)
# -----------------------------------------------------------

@router.patch(
    "/org-units/{org_unit_id}",
    response_model=OrgUnitOut,
    summary="Partially Update Org Unit",
    description="Aktualisiert nur die übergebenen Felder."
)
def update_org_unit(
    org_unit_id: int,
    payload: OrgUnitUpdate,    # ⬅️ nur optionale Felder!
    db: Session = Depends(get_db),
):
    ou = _get_org_unit_or_404(db, org_unit_id)

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(ou, key, value)

    db.add(ou)
    db.commit()
    db.refresh(ou)
    return ou


# -----------------------------------------------------------
# DELETE (soft delete)
# -----------------------------------------------------------

@router.delete("/org-units/{org_unit_id}")
def delete_org_unit(org_unit_id: int, db: Session = Depends(get_db)):
    ou = _get_org_unit_or_404(db, org_unit_id)
    ou.is_active = False
    db.add(ou)
    db.commit()
    return {"ok": True}
