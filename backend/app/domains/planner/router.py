# app/domains/planner/router.py

from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.deps import get_db
from app.domains.planner import models, schemas
from app.domains.candidate.models import Candidate

router = APIRouter(prefix="/planner", tags=["Planner"])


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
    Entspricht dem Frontend-Aufruf GET /planner/exam-days.
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
    exam_days = db.execute(stmt).scalars().all()
    return exam_days


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
    """
    exam_day = models.ExamDay(
        org_unit_id=payload.org_unit_id,
        subject_id=payload.subject_id,
        time_scheme_id=payload.time_scheme_id,
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
    """
    Einzelnen Prüfungstag per ID laden.
    """
    exam_day = db.get(models.ExamDay, exam_day_id)
    if not exam_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam day not found",
        )
    return exam_day


# -------------------------------------------------------------------
# Committees pro Exam Day
# -------------------------------------------------------------------

@router.get(
    "/exam-days/{exam_day_id}/committees",
    response_model=list[schemas.ExamDayCommitteeOut],
)
def list_committees_for_exam_day(exam_day_id: int, db: Session = Depends(get_db)):
    stmt = select(models.ExamDayCommittee).where(
        models.ExamDayCommittee.exam_day_id == exam_day_id
    )
    return db.scalars(stmt).all()


@router.post(
    "/exam-days/{exam_day_id}/committees",
    response_model=schemas.ExamDayCommitteeOut,
)
def add_committee_to_exam_day(
    exam_day_id: int,
    payload: schemas.ExamDayCommitteeCreate,
    db: Session = Depends(get_db),
):
    entry = models.ExamDayCommittee(
        exam_day_id=exam_day_id,
        committee_id=payload.committee_id,
        room=payload.room,
        location=payload.location,
        time_scheme_id=payload.time_scheme_id,
    )

    db.add(entry)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Committee kann nicht hinzugefügt werden. Prüfe committee_id und time_scheme_id.",
        )

    db.refresh(entry)
    return entry


# -------------------------------------------------------------------
# Slots generieren
# -------------------------------------------------------------------

@router.post("/exam-day-committees/{edc_id}/generate-slots")
def generate_slots(edc_id: int, db: Session = Depends(get_db)):
    """
    Slots für einen ExamDayCommittee anhand des zugeordneten TimeSchemes generieren.
    """
    # Committee-Eintrag laden
    edc = db.get(models.ExamDayCommittee, edc_id)
    if not edc:
        raise HTTPException(status_code=404, detail="Committee entry not found")

    # Zeitschema laden
    ts = db.get(models.TimeScheme, edc.time_scheme_id)
    if not ts:
        raise HTTPException(status_code=400, detail="Zeitschema nicht gefunden")

    # Prüftag laden
    exam_day = db.get(models.ExamDay, edc.exam_day_id)
    if not exam_day:
        raise HTTPException(status_code=404, detail="Exam day not found")

    # Basiszeit berechnen
    current_start = datetime.combine(exam_day.date, ts.default_first_slot_start)

    created = 0
    for index in range(1, ts.max_slots + 1):
        start = current_start
        end = start + timedelta(minutes=ts.exam_duration_minutes)

        slot = models.ExamSlot(
            exam_day_id=edc.exam_day_id,
            committee_id=edc.committee_id,
            slot_index=index,
            start_time=start.time(),
            end_time=end.time(),
            status="free",
        )

        db.add(slot)
        created += 1

        # nächster Slot = Ende + Diskussion-Pause
        current_start = end + timedelta(minutes=ts.discussion_buffer_minutes)

    db.commit()
    return {"created_slots": created}


# -------------------------------------------------------------------
# Slots eines Exam Days (inkl. Candidate-Infos)
# -------------------------------------------------------------------
@router.get("/exam-days/{exam_day_id}/slots")
def list_slots_for_exam_day(
    exam_day_id: int,
    committee_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    """
    Alle Slots eines Prüfungstags inkl. ggf. zugeordnetem Exam und Kandidat.
    Gibt ein reines JSON-Array mit allen Feldern zurück.
    """

    stmt = (
        select(
            models.ExamSlot,
            models.Exam.exam_id,
            models.Exam.candidate_id,
            Candidate.first_name,
            Candidate.last_name,
        )
        .outerjoin(
            models.Exam,
            models.Exam.exam_slot_id == models.ExamSlot.exam_slot_id,
        )
        .outerjoin(
            Candidate,
            Candidate.candidate_id == models.Exam.candidate_id,
        )
        .where(models.ExamSlot.exam_day_id == exam_day_id)
        .order_by(
            models.ExamSlot.committee_id.asc(),
            models.ExamSlot.slot_index.asc(),
        )
    )

    if committee_id is not None:
        stmt = stmt.where(models.ExamSlot.committee_id == committee_id)

    rows = db.execute(stmt).all()

    result: list[dict] = []
    for slot, exam_id, candidate_id, first_name, last_name in rows:
        result.append(
            {
                "exam_slot_id": slot.exam_slot_id,
                "exam_day_id": slot.exam_day_id,
                "committee_id": slot.committee_id,
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
# Exams (Zuordnung Slot ↔ Candidate)
# -------------------------------------------------------------------

@router.post("/exams", response_model=schemas.ExamOut, status_code=201)
def create_exam(payload: schemas.ExamCreate, db: Session = Depends(get_db)):
    # Slot laden
    slot = db.get(models.ExamSlot, payload.exam_slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    # Candidate prüfen
    cand = db.get(Candidate, payload.candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # 🔒 Regel: Kandidat nur einmal pro Ausschuss + exam_type
    existing = (
        db.query(models.Exam)
        .filter(
            models.Exam.candidate_id == payload.candidate_id,
            models.Exam.committee_id == slot.committee_id,
            models.Exam.exam_type == payload.exam_type,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Kandidat ist für diesen Ausschuss und Prüfungstyp bereits eingeplant.",
        )

    exam = models.Exam(
        candidate_id=payload.candidate_id,
        exam_day_id=payload.exam_day_id,
        exam_slot_id=payload.exam_slot_id,
        committee_id=slot.committee_id,
        exam_type=payload.exam_type,
        status="planned",
    )

    slot.status = "booked"
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam


@router.delete("/exams/{exam_id}")
def delete_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = db.get(models.Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Slot wieder freigeben
    slot = db.get(models.ExamSlot, exam.exam_slot_id)
    if slot and slot.status == "booked":
        slot.status = "free"

    db.delete(exam)
    db.commit()
    return {"ok": True}


@router.patch("/exams/{exam_id}")
def update_exam(
    exam_id: int,
    payload: schemas.ExamCreate,   # gleiche Felder wie beim Anlegen
    db: Session = Depends(get_db),
):
    exam = db.get(models.Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Kandidat / Typ anpassen
    exam.candidate_id = payload.candidate_id
    exam.exam_type = payload.exam_type

    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam

# End of file
