# app/domains/planner/router.py

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.deps import get_db
from app.domains.exam.models import Exam
from app.domains.planner import models, schemas
from app.domains.planner.models import ExamSlot
from app.domains.candidate.models import Candidate
from app.domains.admin.models import TimeScheme, TimeSchemeDefault

from app.domains.exam.services.parts_service import ensure_exam_parts_for_exam

router = APIRouter(prefix="/planner", tags=["Planner"])


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def _resolve_default_time_scheme_id(db: Session, org_unit_id: int, subject_id: int) -> int:
    """
    Resolve default time_scheme_id for (org_unit_id, subject_id) by walking up
    organization_unit.parent_org_unit_id until a matching time_scheme_default exists.
    Fallback: 1
    """
    current = org_unit_id
    while current is not None:
        ts_id = db.execute(
            select(TimeSchemeDefault.time_scheme_id).where(
                TimeSchemeDefault.org_unit_id == current,
                TimeSchemeDefault.subject_id == subject_id,
                TimeSchemeDefault.is_active == 1,
            )
        ).scalar_one_or_none()

        if ts_id is not None:
            return int(ts_id)

        current = db.execute(
            select(models.OrganizationUnit.parent_org_unit_id).where(
                models.OrganizationUnit.org_unit_id == current
            )
        ).scalar_one_or_none()

    return 1


from sqlalchemy import exists

def _team_can_delete(db: Session, team_id: int) -> bool:
    """
    can_delete := no exams exist for slots of that team.
    """
    stmt = select(
        exists().where(
            Exam.exam_slot_id == models.ExamSlot.exam_slot_id,
        ).where(
            models.ExamSlot.exam_day_team_id == team_id
        )
    )
    has_exams = bool(db.execute(stmt).scalar())
    return not has_exams



def _team_slot_count(db: Session, team_id: int) -> int:
    return int(
        db.execute(
            select(func.count(models.ExamSlot.exam_slot_id)).where(
                models.ExamSlot.exam_day_team_id == team_id
            )
        ).scalar_one()
        or 0
    )


def _team_exam_count(db: Session, team_id: int) -> int:
    # exams via slots
    return int(
        db.execute(
            select(func.count(Exam.exam_id))
            .select_from(Exam)
            .join(models.ExamSlot, Exam.exam_slot_id == models.ExamSlot.exam_slot_id)
            .where(models.ExamSlot.exam_day_team_id == team_id)
        ).scalar_one()
        or 0
    )


def _load_team(db: Session, team_id: int) -> models.ExamDayTeam:
    team = db.get(models.ExamDayTeam, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


def _ensure_team_slots_deletable(db: Session, team_id: int) -> None:
    """
    For deleting slots we must ensure:
      - no exams exist for these slots
      - no slots are booked/reserved/blocked (optional strictness)
    """
    # exams exist?
    has_exams = (
        db.query(Exam)
        .join(models.ExamSlot, Exam.exam_slot_id == models.ExamSlot.exam_slot_id)
        .filter(models.ExamSlot.exam_day_team_id == team_id)
        .first()
        is not None
    )
    if has_exams:
        raise HTTPException(
            status_code=400,
            detail="Slots können nicht gelöscht werden, da bereits Prüfungen/Kandidatenzuordnungen existieren.",
        )

    # any non-free slots?
    has_non_free = (
        db.query(models.ExamSlot)
        .filter(
            models.ExamSlot.exam_day_team_id == team_id,
            models.ExamSlot.status != "free",
        )
        .first()
        is not None
    )
    if has_non_free:
        raise HTTPException(
            status_code=400,
            detail="Slots können nicht gelöscht werden, da nicht alle Slots den Status 'free' haben.",
        )


# -------------------------------------------------------------------
# Exam Days
# -------------------------------------------------------------------

@router.get("/exam-days", response_model=List[schemas.ExamDayOut])
def list_exam_days(
    org_unit_id: Optional[int] = Query(None),
    subject_id: Optional[int] = Query(None),
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    """
    Liste aller Prüfungstage (optional gefiltert nach OrgUnit, Fach, Datum).
    """
    stmt = select(models.ExamDay)

    if org_unit_id is not None:
        stmt = stmt.where(models.ExamDay.org_unit_id == org_unit_id)
    if subject_id is not None:
        stmt = stmt.where(models.ExamDay.subject_id == subject_id)
    if from_date is not None:
        stmt = stmt.where(models.ExamDay.date >= from_date)
    if to_date is not None:
        stmt = stmt.where(models.ExamDay.date <= to_date)

    stmt = stmt.order_by(models.ExamDay.date.asc(), models.ExamDay.exam_day_id.asc())
    return db.execute(stmt).scalars().all()


@router.delete(
    "/exam-days/{exam_day_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_exam_day(
    exam_day_id: int,
    db: Session = Depends(get_db),
):
    exam_day = (
        db.query(models.ExamDay)
        .filter(models.ExamDay.exam_day_id == exam_day_id)
        .first()
    )
    if not exam_day:
        raise HTTPException(status_code=404, detail="Exam day not found")

    # Block: any exams for this day?
    has_exams = (
        db.query(Exam)
        .filter(Exam.exam_day_id == exam_day_id)
        .first()
        is not None
    )
    if has_exams:
        raise HTTPException(
            status_code=400,
            detail="Prüfungstag kann nicht gelöscht werden, da bereits Prüfungen angelegt sind.",
        )

    db.delete(exam_day)
    db.commit()
    return


@router.post(
    "/exam-days",
    response_model=schemas.ExamDayOut,
    status_code=status.HTTP_201_CREATED,
)
def create_exam_day(
    payload: schemas.ExamDayCreate,
    db: Session = Depends(get_db),
):
    """
    Neuen Prüfungstag anlegen.
    time_scheme_id kann vom Frontend kommen; wenn nicht gesetzt, wird Default ermittelt.
    """
    # If payload.time_scheme_id is optional in your schema, resolve it.
    time_scheme_id = payload.time_scheme_id
    if time_scheme_id is None:
        time_scheme_id = _resolve_default_time_scheme_id(db, payload.org_unit_id, payload.subject_id)

    exam_day = models.ExamDay(
        org_unit_id=payload.org_unit_id,
        subject_id=payload.subject_id,
        time_scheme_id=time_scheme_id,
        date=payload.date,
        location=payload.location,
        default_room=payload.default_room,
        status=payload.status,
        is_active=payload.is_active,
    )

    db.add(exam_day)
    db.commit()
    db.refresh(exam_day)
    return exam_day


@router.get("/exam-days/{exam_day_id}", response_model=schemas.ExamDayOut)
def get_exam_day(
    exam_day_id: int,
    db: Session = Depends(get_db),
):
    exam_day = db.get(models.ExamDay, exam_day_id)
    if not exam_day:
        raise HTTPException(status_code=404, detail="Exam day not found")
    return exam_day


# -------------------------------------------------------------------
# Teams (UI label: "Ausschüsse") pro Exam Day
# -------------------------------------------------------------------

@router.get(
    "/exam-days/{exam_day_id}/teams",
    response_model=list[schemas.ExamDayTeamOut],
)
def list_teams_for_exam_day(exam_day_id: int, db: Session = Depends(get_db)):
    teams = (
        db.query(models.ExamDayTeam)
        .filter(models.ExamDayTeam.exam_day_id == exam_day_id)
        .order_by(models.ExamDayTeam.exam_day_team_id.asc())
        .all()
    )

    result: list[schemas.ExamDayTeamOut] = []
    for t in teams:
        members = (
            db.query(models.ExamDayTeamUser)
            .filter(models.ExamDayTeamUser.exam_day_team_id == t.exam_day_team_id)
            .all()
        )

        member_out = []
        for m in members:
            u = db.get(models.User, m.user_id)
            # User might be missing if deleted; keep robust
            member_out.append(
                schemas.ExamDayTeamMemberOut(
                    user_id=m.user_id,
                    first_name=getattr(u, "first_name", None),
                    last_name=getattr(u, "last_name", None),
                    email=getattr(u, "email", None),
                )
            )

        slot_count = _team_slot_count(db, t.exam_day_team_id)
        exam_count = _team_exam_count(db, t.exam_day_team_id)
        can_delete = _team_can_delete(db, t.exam_day_team_id)

        ts = db.get(TimeScheme, t.time_scheme_id)

        result.append(
            schemas.ExamDayTeamOut(
                exam_day_team_id=t.exam_day_team_id,
                exam_day_id=t.exam_day_id,
                name=t.name,
                time_scheme_id=t.time_scheme_id,
                time_scheme_name=getattr(ts, "name", None),
                members=member_out,
                slot_count=slot_count,
                exam_count=exam_count,
                can_delete=can_delete,
            )
        )

    return result


@router.post(
    "/exam-days/{exam_day_id}/teams",
    response_model=schemas.ExamDayTeamOut,
    status_code=status.HTTP_201_CREATED,
)
def create_team_for_exam_day(
    exam_day_id: int,
    payload: schemas.ExamDayTeamCreate,
    db: Session = Depends(get_db),
):
    """
    Team (UI: Ausschuss) für einen Prüfungstag anlegen.
    - name optional -> "Ausschuss N"
    - exakt 3 user_ids erforderlich
    - time_scheme_id wird standardmäßig vom exam_day übernommen, kann optional überschrieben werden
    """
    exam_day = db.get(models.ExamDay, exam_day_id)
    if not exam_day:
        raise HTTPException(status_code=404, detail="Exam day not found")

    if not payload.user_ids or len(payload.user_ids) != 3:
        raise HTTPException(status_code=400, detail="Es müssen genau 3 Prüfer (user_ids) zugeordnet werden.")

    # Auto-name
    name = payload.name
    if not name:
        existing_count = (
            db.query(func.count(models.ExamDayTeam.exam_day_team_id))
            .filter(models.ExamDayTeam.exam_day_id == exam_day_id)
            .scalar()
        ) or 0
        name = f"Ausschuss {int(existing_count) + 1}"

    time_scheme_id = payload.time_scheme_id or exam_day.time_scheme_id

    team = models.ExamDayTeam(
        exam_day_id=exam_day_id,
        name=name,
        time_scheme_id=time_scheme_id,
        is_active=True,
    )
    db.add(team)
    db.flush()  # get team_id

    # insert members
    for user_id in payload.user_ids:
        db.add(models.ExamDayTeamUser(exam_day_team_id=team.exam_day_team_id, user_id=user_id))

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Team kann nicht angelegt werden. Prüfe user_ids und Datenkonsistenz.")

    db.refresh(team)

    # build response via list endpoint helper
    ts = db.get(TimeScheme, team.time_scheme_id)
    members = (
        db.query(models.ExamDayTeamUser)
        .filter(models.ExamDayTeamUser.exam_day_team_id == team.exam_day_team_id)
        .all()
    )
    member_out = []
    for m in members:
        u = db.get(models.User, m.user_id)
        member_out.append(
            schemas.ExamDayTeamMemberOut(
                user_id=m.user_id,
                first_name=getattr(u, "first_name", None),
                last_name=getattr(u, "last_name", None),
                email=getattr(u, "email", None),
            )
        )

    return schemas.ExamDayTeamOut(
        exam_day_team_id=team.exam_day_team_id,
        exam_day_id=team.exam_day_id,
        name=team.name,
        time_scheme_id=team.time_scheme_id,
        time_scheme_name=getattr(ts, "name", None),
        members=member_out,
        slot_count=_team_slot_count(db, team.exam_day_team_id),
        exam_count=_team_exam_count(db, team.exam_day_team_id),
        can_delete=_team_can_delete(db, team.exam_day_team_id),
    )


@router.delete(
    "/exam-days/teams/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_exam_day_team(team_id: int, db: Session = Depends(get_db)):
    team = _load_team(db, team_id)

    if not _team_can_delete(db, team_id):
        raise HTTPException(
            status_code=400,
            detail="Team kann nicht gelöscht werden, da bereits Prüfungen angelegt sind.",
        )

    # delete slots (safe because no exams)
    db.query(models.ExamSlot).filter(models.ExamSlot.exam_day_team_id == team_id).delete(synchronize_session=False)
    # delete members + team via cascade (members should cascade if FK is set; but delete explicitly is safe)
    db.query(models.ExamDayTeamUser).filter(models.ExamDayTeamUser.exam_day_team_id == team_id).delete(synchronize_session=False)

    db.delete(team)
    db.commit()
    return


@router.patch(
    "/exam-days/teams/{team_id}",
    response_model=schemas.ExamDayTeamOut,
)
def update_exam_day_team(team_id: int, payload: schemas.ExamDayTeamUpdate, db: Session = Depends(get_db)):
    """
    Update team name/time_scheme_id. Changing time_scheme_id does NOT auto-regenerate slots.
    """
    team = _load_team(db, team_id)

    if payload.name is not None:
        team.name = payload.name

    if payload.time_scheme_id is not None:
        # Only allow if no exams exist
        if not _team_can_delete(db, team_id):
            raise HTTPException(
                status_code=400,
                detail="Zeitschema kann nicht geändert werden, da bereits Prüfungen angelegt sind.",
            )
        team.time_scheme_id = payload.time_scheme_id

    db.add(team)
    db.commit()
    db.refresh(team)

    ts = db.get(TimeScheme, team.time_scheme_id)
    members = (
        db.query(models.ExamDayTeamUser)
        .filter(models.ExamDayTeamUser.exam_day_team_id == team.exam_day_team_id)
        .all()
    )
    member_out = []
    for m in members:
        u = db.get(models.User, m.user_id)
        member_out.append(
            schemas.ExamDayTeamMemberOut(
                user_id=m.user_id,
                first_name=getattr(u, "first_name", None),
                last_name=getattr(u, "last_name", None),
                email=getattr(u, "email", None),
            )
        )

    return schemas.ExamDayTeamOut(
        exam_day_team_id=team.exam_day_team_id,
        exam_day_id=team.exam_day_id,
        name=team.name,
        time_scheme_id=team.time_scheme_id,
        time_scheme_name=getattr(ts, "name", None),
        members=member_out,
        slot_count=_team_slot_count(db, team.exam_day_team_id),
        exam_count=_team_exam_count(db, team.exam_day_team_id),
        can_delete=_team_can_delete(db, team.exam_day_team_id),
    )


# -------------------------------------------------------------------
# Slots (Team-basiert)
# -------------------------------------------------------------------

@router.post("/exam-days/teams/{team_id}/slots/generate")
def generate_slots_for_team(
    team_id: int,
    db: Session = Depends(get_db),
):
    """
    Slots für ein Team anhand des zugeordneten TimeSchemes generieren.
    """
    team = _load_team(db, team_id)

    # Prevent overwrite if slots already exist
    existing_slots = (
        db.query(models.ExamSlot)
        .filter(models.ExamSlot.exam_day_team_id == team_id)
        .first()
        is not None
    )
    if existing_slots:
        raise HTTPException(
            status_code=409,
            detail="Slots existieren bereits für dieses Team. Bitte zuerst Slots löschen.",
        )

    ts = db.get(TimeScheme, team.time_scheme_id)
    if not ts:
        raise HTTPException(status_code=400, detail="Zeitschema nicht gefunden")

    exam_day = db.get(models.ExamDay, team.exam_day_id)
    if not exam_day:
        raise HTTPException(status_code=404, detail="Exam day not found")

    # base time
    current_start = datetime.combine(exam_day.date, ts.default_first_slot_start)

    created = 0
    for index in range(1, ts.max_slots + 1):
        start = current_start
        end = start + timedelta(minutes=ts.exam_duration_minutes)

        slot = models.ExamSlot(
            exam_day_id=team.exam_day_id,
            exam_day_team_id=team.exam_day_team_id,
            slot_index=index,
            start_time=start.time(),
            end_time=end.time(),
            status="free",
        )
        db.add(slot)
        created += 1

        # next slot = end + buffer
        current_start = end + timedelta(minutes=ts.discussion_buffer_minutes)

        # lunch break after N slots
        if ts.lunch_after_slots is not None and ts.lunch_break_duration_minutes is not None:
            if index == ts.lunch_after_slots:
                current_start = current_start + timedelta(minutes=ts.lunch_break_duration_minutes)

    db.commit()
    return {"created_slots": created}


@router.delete(
    "/exam-days/teams/{team_id}/slots",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_slots_for_team(team_id: int, db: Session = Depends(get_db)):
    _load_team(db, team_id)

    _ensure_team_slots_deletable(db, team_id)

    db.query(models.ExamSlot).filter(models.ExamSlot.exam_day_team_id == team_id).delete(synchronize_session=False)
    db.commit()
    return


# -------------------------------------------------------------------
# Slots eines Exam Days (inkl. Candidate-Infos) - Team-basiert
# -------------------------------------------------------------------

@router.get("/exam-days/{exam_day_id}/slots")
def list_slots_for_exam_day(
    exam_day_id: int,
    team_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    """
    Alle Slots eines Prüfungstags inkl. ggf. zugeordnetem Exam und Kandidat.
    Optional filter by team_id.
    """
    stmt = (
        select(
            models.ExamSlot,
            Exam.exam_id,
            Exam.candidate_id,
            Candidate.first_name,
            Candidate.last_name,
        )
        .outerjoin(Exam, Exam.exam_slot_id == models.ExamSlot.exam_slot_id)
        .outerjoin(Candidate, Candidate.candidate_id == Exam.candidate_id)
        .where(models.ExamSlot.exam_day_id == exam_day_id)
        .order_by(
            models.ExamSlot.exam_day_team_id.asc(),
            models.ExamSlot.slot_index.asc(),
        )
    )

    if team_id is not None:
        stmt = stmt.where(models.ExamSlot.exam_day_team_id == team_id)

    rows = db.execute(stmt).all()

    result: list[dict] = []
    for slot, exam_id, candidate_id, first_name, last_name in rows:
        result.append(
            {
                "exam_slot_id": slot.exam_slot_id,
                "exam_day_id": slot.exam_day_id,
                "exam_day_team_id": slot.exam_day_team_id,
                "slot_index": slot.slot_index,
                "start_time": slot.start_time.isoformat() if hasattr(slot.start_time, "isoformat") else str(slot.start_time),
                "end_time": slot.end_time.isoformat() if hasattr(slot.end_time, "isoformat") else str(slot.end_time),
                "status": slot.status,
                "exam_id": exam_id,
                "candidate_id": candidate_id,
                "candidate_first_name": first_name,
                "candidate_last_name": last_name,
            }
        )

    return result


# -------------------------------------------------------------------
# Exams (Zuordnung Slot ↔ Candidate) - Team-basiert
# -------------------------------------------------------------------

@router.post("/exams", response_model=schemas.ExamOut, status_code=status.HTTP_201_CREATED)
def create_exam(payload: schemas.ExamCreate, db: Session = Depends(get_db)):

    # Candidate prüfen
    cand = db.get(Candidate, payload.candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    try:
        # Slot row-locken (verhindert double booking)
        slot = db.execute(
            select(models.ExamSlot)
            .where(models.ExamSlot.exam_slot_id == payload.exam_slot_id)
            .with_for_update()
        ).scalar_one_or_none()

        if not slot:
            raise HTTPException(status_code=404, detail="Slot not found")

        if slot.exam_day_team_id is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Slot hat keinen Ausschuss (exam_day_team_id = NULL). "
                    "Bitte Slots für diesen Ausschuss löschen und neu generieren."
                ),
            )

        # Slot-Status prüfen
        if slot.status not in ("free", "reserved"):
            raise HTTPException(
                status_code=409,
                detail=f"Slot ist nicht buchbar (status={slot.status}).",
            )

        # Slot darf noch kein exam_id haben
        if slot.exam_id is not None:
            raise HTTPException(status_code=409, detail="Slot ist bereits mit einer Prüfung verknüpft.")

        # Regel: Kandidat nur einmal pro Team + exam_type
        existing = (
            db.query(Exam.exam_id)
            .join(models.ExamSlot, Exam.exam_slot_id == models.ExamSlot.exam_slot_id)
            .filter(
                Exam.candidate_id == payload.candidate_id,
                models.ExamSlot.exam_day_team_id == slot.exam_day_team_id,
                Exam.exam_type == payload.exam_type,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail="Kandidat ist für dieses Team und Prüfungstyp bereits eingeplant.",
            )

        # Exam anlegen
        exam = Exam(
            candidate_id=payload.candidate_id,
            exam_day_id=slot.exam_day_id,            # <-- aus Slot ziehen (robuster)
            exam_slot_id=slot.exam_slot_id,
            exam_day_team_id=slot.exam_day_team_id,
            exam_type=payload.exam_type,
            status="planned",
        )
        db.add(exam)
        db.flush()  # exam.exam_id verfügbar

        # Slot updaten inkl. exam_id
        slot.status = "booked"
        slot.exam_id = exam.exam_id

        # ExamParts sicherstellen (AEVO: Teil 1+2)
        ensure_exam_parts_for_exam(db, exam)

        db.commit()
        db.refresh(exam)
        return exam

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"create_exam failed: {str(e)}")



@router.delete(
    "/exams/{exam_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Slot wieder freigeben
    slot = db.get(models.ExamSlot, exam.exam_slot_id)
    if slot:
        slot.status = "free"

    db.delete(exam)
    db.commit()
    return


@router.patch("/exams/{exam_id}", response_model=schemas.ExamOut)
def update_exam(
    exam_id: int,
    payload: schemas.ExamCreate,
    db: Session = Depends(get_db),
):
    exam = db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Candidate / Typ anpassen
    exam.candidate_id = payload.candidate_id
    exam.exam_type = payload.exam_type

    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam

# End of file
