from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.domains.admin.models import (
    Committee,
    CommitteeFunction,
    CommitteePosition,
    UserCommittee,
)
from app.domains.admin.schemas import (
    CommitteeCreate,
    CommitteeUpdate,
    CommitteeOut,
    CommitteeFunctionCreate,
    CommitteeFunctionUpdate,
    CommitteeFunctionOut,
    CommitteePositionCreate,
    CommitteePositionUpdate,
    CommitteePositionOut,
    UserCommitteeCreate,
    UserCommitteeUpdate,
    UserCommitteeOut,
    CommitteeMemberOut,
    UserCommitteeAssignmentOut,
)


router = APIRouter(
    prefix="/admin",
    tags=["Administration – Committees"]
)


def _get_committee_or_404(db: Session, committee_id: int) -> Committee:
    obj = db.get(Committee, committee_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Ausschuss nicht gefunden")
    return obj


# -----------------------------------------
# LIST
# -----------------------------------------

@router.get("/committees", response_model=list[CommitteeOut])
def list_committees(
    db: Session = Depends(get_db),
    org_unit_id: int | None = Query(None, description="Filter nach OrgUnit"),
    is_active: bool | None = Query(None, description="Nur aktive / inaktive Ausschüsse"),
):
    q = db.query(Committee)

    if org_unit_id:
        q = q.filter(Committee.org_unit_id == org_unit_id)

    if is_active is not None:
        q = q.filter(Committee.is_active == is_active)

    return q.order_by(Committee.name.asc()).all()


# -----------------------------------------
# GET SINGLE
# -----------------------------------------

@router.get("/committees/{committee_id}", response_model=CommitteeOut)
def get_committee(committee_id: int, db: Session = Depends(get_db)):
    return _get_committee_or_404(db, committee_id)


# -----------------------------------------
# CREATE
# -----------------------------------------

@router.post("/committees", response_model=CommitteeOut, status_code=201)
def create_committee(payload: CommitteeCreate, db: Session = Depends(get_db)):
    obj = Committee(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


# -----------------------------------------
# REPLACE (PUT)
# -----------------------------------------

@router.put(
    "/committees/{committee_id}",
    response_model=CommitteeOut,
    summary="Replace Committee",
    description="Ersetzt den Ausschuss vollständig. Alle Felder müssen angegeben werden."
)
def replace_committee(
    committee_id: int,
    payload: CommitteeCreate,   # vollständiges Schema
    db: Session = Depends(get_db),
):
    obj = _get_committee_or_404(db, committee_id)
    data = payload.model_dump()

    for key, value in data.items():
        setattr(obj, key, value)

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


# -----------------------------------------
# PARTIAL UPDATE (PATCH)
# -----------------------------------------

@router.patch(
    "/committees/{committee_id}",
    response_model=CommitteeOut,
    summary="Partially Update Committee",
    description="Aktualisiert nur die angegebenen Felder."
)
def update_committee(
    committee_id: int,
    payload: CommitteeUpdate,
    db: Session = Depends(get_db),
):
    obj = _get_committee_or_404(db, committee_id)

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(obj, key, value)

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


# -----------------------------------------
# DELETE (soft delete)
# -----------------------------------------

# @router.delete("/committees/{committee_id}")
# def delete_committee(committee_id: int, db: Session = Depends(get_db)):
#     obj = _get_committee_or_404(db, committee_id)
#     obj.is_active = False
#     db.add(obj)
#     db.commit()
#     return {"ok": True}

# --------------------------------------------------
# Delete
# --------------------------------------------------
@router.delete("/committees/{committee_id}")
def delete_committee(committee_id: int, db: Session = Depends(get_db)):
    committee = (
        db.query(Committee)
        .filter(Committee.committee_id == committee_id)
        .first()
    )
    if not committee:
        raise HTTPException(status_code=404, detail="Committee not found")

    db.delete(committee)
    db.commit()
    return {"deleted": True, "committee_id": committee_id}



# -------------------------------------------------
# Helper: get-or-404
# -------------------------------------------------

def _get_committee_function_or_404(db: Session, committee_function_id: int) -> CommitteeFunction:
    obj = db.get(CommitteeFunction, committee_function_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Ausschuss-Funktion nicht gefunden")
    return obj


def _get_committee_position_or_404(db: Session, committee_position_id: int) -> CommitteePosition:
    obj = db.get(CommitteePosition, committee_position_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Ausschuss-Position nicht gefunden")
    return obj


def _get_user_committee_or_404(db: Session, user_committee_id: int) -> UserCommittee:
    obj = db.get(UserCommittee, user_committee_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Benutzer-Ausschuss-Zuordnung nicht gefunden")
    return obj


# =================================================
#  A) committee_function
# =================================================

@router.get("/committee-functions", response_model=list[CommitteeFunctionOut])
def list_committee_functions(
    db: Session = Depends(get_db),
    search: str | None = Query(None, description="Filter auf code / display_name_de"),
):
    q = db.query(CommitteeFunction)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (CommitteeFunction.code.ilike(like)) |
            (CommitteeFunction.display_name_de.ilike(like))
        )
    return q.order_by(CommitteeFunction.code.asc()).all()


@router.get("/committee-functions/{committee_function_id}", response_model=CommitteeFunctionOut)
def get_committee_function(committee_function_id: int, db: Session = Depends(get_db)):
    return _get_committee_function_or_404(db, committee_function_id)


@router.post("/committee-functions", response_model=CommitteeFunctionOut, status_code=201)
def create_committee_function(payload: CommitteeFunctionCreate, db: Session = Depends(get_db)):
    obj = CommitteeFunction(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put(
    "/committee-functions/{committee_function_id}",
    response_model=CommitteeFunctionOut,
    summary="Replace Committee Function",
)
def replace_committee_function(
    committee_function_id: int,
    payload: CommitteeFunctionCreate,
    db: Session = Depends(get_db),
):
    obj = _get_committee_function_or_404(db, committee_function_id)
    data = payload.model_dump()
    for key, value in data.items():
        setattr(obj, key, value)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch(
    "/committee-functions/{committee_function_id}",
    response_model=CommitteeFunctionOut,
    summary="Partially Update Committee Function",
)
def update_committee_function(
    committee_function_id: int,
    payload: CommitteeFunctionUpdate,
    db: Session = Depends(get_db),
):
    obj = _get_committee_function_or_404(db, committee_function_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(obj, key, value)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/committee-functions/{committee_function_id}")
def delete_committee_function(committee_function_id: int, db: Session = Depends(get_db)):
    obj = _get_committee_function_or_404(db, committee_function_id)
    db.delete(obj)
    db.commit()
    return {"ok": True}


# =================================================
#  B) committee_position
# =================================================

@router.get("/committee-positions", response_model=list[CommitteePositionOut])
def list_committee_positions(
    db: Session = Depends(get_db),
    search: str | None = Query(None, description="Filter auf code / display_name_de"),
):
    q = db.query(CommitteePosition)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (CommitteePosition.code.ilike(like)) |
            (CommitteePosition.display_name_de.ilike(like))
        )
    return q.order_by(CommitteePosition.code.asc()).all()


@router.get("/committee-positions/{committee_position_id}", response_model=CommitteePositionOut)
def get_committee_position(committee_position_id: int, db: Session = Depends(get_db)):
    return _get_committee_position_or_404(db, committee_position_id)


@router.post("/committee-positions", response_model=CommitteePositionOut, status_code=201)
def create_committee_position(payload: CommitteePositionCreate, db: Session = Depends(get_db)):
    obj = CommitteePosition(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put(
    "/committee-positions/{committee_position_id}",
    response_model=CommitteePositionOut,
    summary="Replace Committee Position",
)
def replace_committee_position(
    committee_position_id: int,
    payload: CommitteePositionCreate,
    db: Session = Depends(get_db),
):
    obj = _get_committee_position_or_404(db, committee_position_id)
    data = payload.model_dump()
    for key, value in data.items():
        setattr(obj, key, value)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch(
    "/committee-positions/{committee_position_id}",
    response_model=CommitteePositionOut,
    summary="Partially Update Committee Position",
)
def update_committee_position(
    committee_position_id: int,
    payload: CommitteePositionUpdate,
    db: Session = Depends(get_db),
):
    obj = _get_committee_position_or_404(db, committee_position_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(obj, key, value)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/committee-positions/{committee_position_id}")
def delete_committee_position(committee_position_id: int, db: Session = Depends(get_db)):
    obj = _get_committee_position_or_404(db, committee_position_id)
    db.delete(obj)
    db.commit()
    return {"ok": True}


# =================================================
#  C) user_committee (Zuordnung User ↔ Ausschuss)
# =================================================

@router.get("/user-committees", response_model=list[UserCommitteeOut])
def list_user_committees(
    db: Session = Depends(get_db),
    user_id: int | None = Query(None),
    committee_id: int | None = Query(None),
    is_active: bool | None = Query(None),
):
    q = db.query(UserCommittee)

    if user_id:
        q = q.filter(UserCommittee.user_id == user_id)
    if committee_id:
        q = q.filter(UserCommittee.committee_id == committee_id)
    if is_active is not None:
        q = q.filter(UserCommittee.is_active == is_active)

    return q.order_by(UserCommittee.user_id.asc(), UserCommittee.committee_id.asc()).all()


@router.get("/user-committees/{user_committee_id}", response_model=UserCommitteeOut)
def get_user_committee(user_committee_id: int, db: Session = Depends(get_db)):
    return _get_user_committee_or_404(db, user_committee_id)


@router.post("/user-committees", response_model=UserCommitteeOut, status_code=201)
def create_or_update_user_committee(
    payload: UserCommitteeCreate,
    db: Session = Depends(get_db),
):
    """
    Upsert für user_committee:
    - Wenn (user_id, committee_id) bereits existiert -> UPDATE (Funktion, Position, is_active)
    - Sonst -> INSERT
    """

    # 1) Prüfen, ob es schon eine Zuordnung für (user_id, committee_id) gibt
    existing = (
        db.query(UserCommittee)
        .filter(
            UserCommittee.user_id == payload.user_id,
            UserCommittee.committee_id == payload.committee_id,
        )
        .first()
    )

    if existing:
        # 2) UPDATE: Funktion, Position, Aktiv-Flag aktualisieren
        existing.committee_function_id = payload.committee_function_id
        existing.committee_position_id = payload.committee_position_id
        # is_active aus Payload übernehmen (bei Create-Schema i. d. R. Pflichtfeld)
        existing.is_active = payload.is_active

        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    # 3) INSERT, wenn Kombination noch nicht existiert
    obj = UserCommittee(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put(
    "/user-committees/{user_committee_id}",
    response_model=UserCommitteeOut,
    summary="Replace User Committee",
)
def replace_user_committee(
    user_committee_id: int,
    payload: UserCommitteeCreate,
    db: Session = Depends(get_db),
):
    obj = _get_user_committee_or_404(db, user_committee_id)
    data = payload.model_dump()
    for key, value in data.items():
        setattr(obj, key, value)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch(
    "/user-committees/{user_committee_id}",
    response_model=UserCommitteeOut,
    summary="Partially Update User Committee",
)
def update_user_committee(
    user_committee_id: int,
    payload: UserCommitteeUpdate,
    db: Session = Depends(get_db),
):
    obj = _get_user_committee_or_404(db, user_committee_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(obj, key, value)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/user-committees/{user_committee_id}")
def delete_user_committee(user_committee_id: int, db: Session = Depends(get_db)):
    obj = _get_user_committee_or_404(db, user_committee_id)
    obj.is_active = False           # Soft Delete
    db.add(obj)
    db.commit()
    return {"ok": True}

@router.get(
    "/committees/{committee_id}/members",
    response_model=list[CommitteeMemberOut],
    summary="List Committee Members",
    description="Gibt alle aktiven (oder optional alle) Mitglieder eines Ausschusses zurück."
)
def list_committee_members(
    committee_id: int,
    include_inactive: bool = Query(False, description="Auch inaktive Mitglieder anzeigen"),
    db: Session = Depends(get_db),
):
    members = (
        db.query(UserCommittee)
        .filter(UserCommittee.committee_id == committee_id)
        .filter(UserCommittee.is_active == (True if not include_inactive else UserCommittee.is_active))
        .all()
    )

    output = []
    for m in members:
        output.append(
            CommitteeMemberOut(
                user_committee_id=m.user_committee_id,
                user_id=m.user_id,
                committee_id=m.committee_id,
                committee_function_id=m.committee_function_id,
                committee_function_name=m.committee_function.display_name_de if m.committee_function else None,
                committee_position_id=m.committee_position_id,
                committee_position_name=m.committee_position.display_name_de if m.committee_position else None,
                display_name=m.user.display_name,
                email=m.user.email,
                is_active=m.is_active,
            )
        )

    return output

@router.get(
    "/users/{user_id}/committees",
    response_model=list[UserCommitteeAssignmentOut],
    summary="List Committees of a User",
    description="Gibt alle Ausschüsse zurück, in denen der User Mitglied ist."
)
def list_user_committees(
    user_id: int,
    include_inactive: bool = Query(False, description="Auch inaktive anzeigen"),
    db: Session = Depends(get_db),
):
    items = (
        db.query(UserCommittee)
        .filter(UserCommittee.user_id == user_id)
        .filter(UserCommittee.is_active == (True if not include_inactive else UserCommittee.is_active))
        .all()
    )

    output = []
    for m in items:
        output.append(
            UserCommitteeAssignmentOut(
                user_committee_id=m.user_committee_id,
                user_id=m.user_id,
                committee_id=m.committee_id,
                committee_name=m.committee.name,
                org_unit_id=m.committee.org_unit_id,
                org_unit_name=m.committee.org_unit.name,
                committee_function_id=m.committee_function_id,
                committee_function_name=m.committee_function.display_name_de if m.committee_function else None,
                committee_position_id=m.committee_position_id,
                committee_position_name=m.committee_position.display_name_de if m.committee_position else None,
                is_active=m.is_active,
            )
        )

    return output



# End of file