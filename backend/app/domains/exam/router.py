# app/domains/exam/router.py
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_db
from app.domains.auth.auth import get_current_user

from app.domains.exam.models import (
    GradeKeyEntry,
    Exam,
    ExamPart,
    ExamProtocol,
    ExamCheckin,
    GradingSheetDefinition,
    GradingArea,
    GradingCriterionDefinition,
    ExamGradingSheet,
)

from app.domains.exam.schemas import (
    ActiveGradeKeyOut,
    GradeKeyEntryOut,
    GradingSheetDefinitionOut,
    GradingSheetDefinitionCreate,
    GradingSheetDefinitionUpdate,
    GradingAreaOut,
    GradingAreaCreate,
    GradingAreaUpdate,
    GradingCriterionOut,
    GradingCriterionCreate,
    GradingCriterionUpdate,
    ExamCheckinOut,
    ExamCheckinUpdate,
    ExamProtocolOut,
    ExamProtocolUpdate,
    ExamStartIn,
    ExamStartOut,
    ExamWithPartsOut,
    MemberGradingSheetOut,
    MemberGradingSheetViewOut,
    GradingSheetUpdateIn,
    FinalSheetOut,
    FinalSheetDecisionIn,
)

from app.domains.exam.services.grading_service import (
    get_or_create_member_sheet,
    update_member_sheet,
    submit_member_sheet,
    build_final_sheet_view,
    save_final_sheet_decisions,
    get_member_sheet_view,
    _get_active_grade_key_version_id,
)

from app.domains.exam.services.parts_service import ensure_exam_parts_for_exam
from app.domains.exam.expert_discussion_router import router as expert_discussion_router


router = APIRouter(prefix="/exam", tags=["Exam"])
router.include_router(expert_discussion_router)


def _exam_start_out(exam: Exam, db: Session) -> ExamStartOut:
    """Hilfsfunktion: ExamStartOut aus Exam-Objekt bauen."""
    part1 = db.execute(
        select(ExamPart).where(ExamPart.exam_id == exam.exam_id, ExamPart.part_number == 1)
    ).scalar_one_or_none()
    return ExamStartOut(
        exam_id=exam.exam_id,
        status=exam.status,
        started_at=exam.started_at,
        paused_at=getattr(exam, "paused_at", None),
        total_paused_seconds=getattr(exam, "total_paused_seconds", 0) or 0,
        attendance_status=exam.attendance_status,
        part1_mode=(part1.part_mode if part1 else None),
    )


# ==================================================
# Grade Key (IHK) API
# ==================================================

@router.get("/subjects/{subject_id}/grade-key/active", response_model=ActiveGradeKeyOut)
def get_active_grade_key_version(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        version_id = _get_active_grade_key_version_id(db, subject_id)
        return ActiveGradeKeyOut(subject_id=subject_id, grade_key_version_id=version_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/grade-keys/{grade_key_version_id}/entries", response_model=List[GradeKeyEntryOut])
def list_grade_key_entries(
    grade_key_version_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = (
        db.query(GradeKeyEntry)
        .filter(GradeKeyEntry.grade_key_version_id == grade_key_version_id)
        .order_by(GradeKeyEntry.points_100.desc())
        .all()
    )
    return rows


# ==================================================
# Grading Sheet Definitions (Teil 1)
# ==================================================

@router.get("/subjects/{subject_id}/grading-sheets", response_model=List[GradingSheetDefinitionOut])
def list_grading_sheets_for_subject(subject_id: int, db: Session = Depends(get_db)):
    sheets = (
        db.query(GradingSheetDefinition)
        .filter(GradingSheetDefinition.subject_id == subject_id)
        .order_by(GradingSheetDefinition.part_number, GradingSheetDefinition.version_no.desc())
        .all()
    )
    return sheets


@router.post("/subjects/{subject_id}/grading-sheets", response_model=GradingSheetDefinitionOut, status_code=201)
def create_grading_sheet_definition(subject_id: int, data: GradingSheetDefinitionCreate, db: Session = Depends(get_db)):
    sheet = GradingSheetDefinition(
        subject_id=subject_id,
        part_number=data.part_number,
        title=data.title,
        version_no=data.version_no,
        is_active=data.is_active,
        valid_from=data.valid_from,
        valid_to=data.valid_to,
        variant=getattr(data, "variant", "presentation"),
    )
    db.add(sheet)
    db.commit()
    db.refresh(sheet)
    return sheet


@router.get("/grading-sheets/{grading_sheet_definition_id}", response_model=GradingSheetDefinitionOut)
def get_grading_sheet_definition(grading_sheet_definition_id: int, db: Session = Depends(get_db)):
    sheet = db.query(GradingSheetDefinition).filter(
        GradingSheetDefinition.grading_sheet_definition_id == grading_sheet_definition_id
    ).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Grading sheet not found")
    return sheet


@router.put("/grading-sheets/{grading_sheet_definition_id}", response_model=GradingSheetDefinitionOut)
def update_grading_sheet_definition(grading_sheet_definition_id: int, data: GradingSheetDefinitionUpdate, db: Session = Depends(get_db)):
    sheet = db.query(GradingSheetDefinition).filter(
        GradingSheetDefinition.grading_sheet_definition_id == grading_sheet_definition_id
    ).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Grading sheet not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(sheet, field, value)
    db.commit()
    db.refresh(sheet)
    return sheet


@router.post("/grading-sheets/{grading_sheet_definition_id}/areas", response_model=GradingAreaOut, status_code=201)
def create_grading_area(grading_sheet_definition_id: int, data: GradingAreaCreate, db: Session = Depends(get_db)):
    sheet = db.query(GradingSheetDefinition).filter(
        GradingSheetDefinition.grading_sheet_definition_id == grading_sheet_definition_id
    ).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Grading sheet not found")
    area = GradingArea(
        grading_sheet_definition_id=grading_sheet_definition_id,
        area_number=data.area_number,
        title=data.title,
        description=data.description,
        is_active=data.is_active,
    )
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@router.put("/grading-areas/{grading_area_id}", response_model=GradingAreaOut)
def update_grading_area(grading_area_id: int, data: GradingAreaUpdate, db: Session = Depends(get_db)):
    area = db.query(GradingArea).filter(GradingArea.grading_area_id == grading_area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Grading area not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(area, field, value)
    db.commit()
    db.refresh(area)
    return area


@router.post("/grading-areas/{grading_area_id}/criteria", response_model=GradingCriterionOut, status_code=201)
def create_criterion_for_area(grading_area_id: int, data: GradingCriterionCreate, db: Session = Depends(get_db)):
    area = db.query(GradingArea).filter(GradingArea.grading_area_id == grading_area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Grading area not found")
    criterion = GradingCriterionDefinition(
        grading_sheet_definition_id=area.grading_sheet_definition_id,
        grading_area_id=grading_area_id,
        criterion_number=data.criterion_number,
        title=data.title,
        description=data.description,
        max_points=data.max_points,
        weight=data.weight,
        is_active=data.is_active,
    )
    db.add(criterion)
    db.commit()
    db.refresh(criterion)
    return criterion


@router.put("/grading-criteria/{grading_criterion_definition_id}", response_model=GradingCriterionOut)
def update_criterion(grading_criterion_definition_id: int, data: GradingCriterionUpdate, db: Session = Depends(get_db)):
    criterion = db.query(GradingCriterionDefinition).filter(
        GradingCriterionDefinition.grading_criterion_definition_id == grading_criterion_definition_id
    ).first()
    if not criterion:
        raise HTTPException(status_code=404, detail="Criterion not found")
    payload = data.model_dump(exclude_unset=True)
    if "grading_area_id" in payload and payload["grading_area_id"] is not None:
        target_area = db.query(GradingArea).filter(GradingArea.grading_area_id == payload["grading_area_id"]).first()
        if not target_area:
            raise HTTPException(status_code=404, detail="Target area not found")
        criterion.grading_sheet_definition_id = target_area.grading_sheet_definition_id
    for field, value in payload.items():
        setattr(criterion, field, value)
    db.commit()
    db.refresh(criterion)
    return criterion


# ==================================================
# Exam Parts & Core
# ==================================================

@router.get("/exams/{exam_id}/parts", response_model=ExamWithPartsOut)
def get_exam_with_parts(exam_id: int, db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.exam_id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    ensure_exam_parts_for_exam(db, exam)

    parts = (
        db.query(ExamPart)
        .filter(ExamPart.exam_id == exam.exam_id)
        .order_by(ExamPart.part_number)
        .all()
    )
    part1 = next((p for p in parts if p.part_number == 1), None)

    return ExamWithPartsOut(
        exam_id=exam.exam_id,
        exam_type=exam.exam_type,
        status=exam.status,
        subject_id=exam.subject_id,
        started_at=getattr(exam, "started_at", None),
        paused_at=getattr(exam, "paused_at", None),
        total_paused_seconds=getattr(exam, "total_paused_seconds", 0) or 0,
        attendance_status=getattr(exam, "attendance_status", None),
        part1_mode=(part1.part_mode if part1 else None),
        parts=parts,
    )


@router.post("/exams/{exam_id}/start", response_model=ExamStartOut)
def start_exam(
    exam_id: int,
    payload: ExamStartIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    exam = db.execute(select(Exam).where(Exam.exam_id == exam_id).with_for_update()).scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if exam.status in ("done", "canceled"):
        raise HTTPException(status_code=409, detail=f"Exam cannot be started (status={exam.status}).")

    now = datetime.utcnow()

    # Erste Start: started_at setzen
    if exam.started_at is None:
        exam.started_at = now

    # Fortsetzen nach Pause: akkumuliere Pausenzeit
    if exam.status == "paused" and getattr(exam, "paused_at", None) is not None:
        pause_duration = int((now - exam.paused_at).total_seconds())
        exam.total_paused_seconds = (getattr(exam, "total_paused_seconds", 0) or 0) + pause_duration
        exam.paused_at = None

    if exam.status in ("planned", "paused"):
        exam.status = "in_progress"

    if exam.attendance_status is None:
        exam.attendance_status = "present"

    checkin = db.get(ExamCheckin, exam_id)
    if checkin is None:
        db.add(ExamCheckin(exam_id=exam_id))

    ensure_exam_parts_for_exam(db, exam)
    db.flush()

    part1 = db.execute(
        select(ExamPart).where(ExamPart.exam_id == exam.exam_id, ExamPart.part_number == 1)
    ).scalar_one_or_none()

    if payload.part1_mode and part1 is not None:
        part1.part_mode = payload.part1_mode

    db.commit()
    db.refresh(exam)
    if part1:
        db.refresh(part1)

    return _exam_start_out(exam, db)


@router.post("/exams/{exam_id}/stop", response_model=ExamStartOut)
def stop_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Stoppt eine laufende Prüfung → paused. Setzt paused_at auf jetzt."""
    exam = db.execute(select(Exam).where(Exam.exam_id == exam_id).with_for_update()).scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if exam.status not in ("in_progress", "paused"):
        raise HTTPException(status_code=409, detail=f"Exam cannot be stopped (status={exam.status}).")

    exam.status = "paused"
    exam.paused_at = datetime.utcnow()
    db.commit()
    db.refresh(exam)

    return _exam_start_out(exam, db)


@router.post("/exams/{exam_id}/reset", response_model=ExamStartOut)
def reset_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Setzt Prüfung vollständig zurück: status → planned, alle Zeitfelder → None/0."""
    exam = db.execute(select(Exam).where(Exam.exam_id == exam_id).with_for_update()).scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if exam.status in ("done", "canceled"):
        raise HTTPException(status_code=409, detail=f"Exam cannot be reset (status={exam.status}).")

    exam.status = "planned"
    exam.started_at = None
    exam.paused_at = None
    exam.total_paused_seconds = 0
    db.commit()
    db.refresh(exam)

    return _exam_start_out(exam, db)


# ==================================================
# Check-in
# ==================================================

@router.get("/exams/{exam_id}/checkin", response_model=ExamCheckinOut)
def get_exam_checkin(exam_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    exam = db.query(Exam).filter(Exam.exam_id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    checkin = db.query(ExamCheckin).filter(ExamCheckin.exam_id == exam_id).first()
    if not checkin:
        checkin = ExamCheckin(exam_id=exam_id)
        db.add(checkin)
        db.commit()
        db.refresh(checkin)
    return checkin


@router.put("/exams/{exam_id}/checkin", response_model=ExamCheckinOut)
def update_exam_checkin(exam_id: int, data: ExamCheckinUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    exam = db.query(Exam).filter(Exam.exam_id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    checkin = db.query(ExamCheckin).filter(ExamCheckin.exam_id == exam_id).first()
    if not checkin:
        checkin = ExamCheckin(exam_id=exam_id)
        db.add(checkin)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(checkin, field, value)
    db.commit()
    db.refresh(checkin)
    return checkin


# ==================================================
# Protocol
# ==================================================

@router.get("/exams/{exam_id}/protocol", response_model=ExamProtocolOut)
def get_exam_protocol(exam_id: int, db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.exam_id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    protocol = db.query(ExamProtocol).filter(ExamProtocol.exam_id == exam.exam_id).first()
    if not protocol:
        protocol = ExamProtocol(exam_id=exam.exam_id)
        db.add(protocol)
        db.commit()
        db.refresh(protocol)
    part1 = db.query(ExamPart).filter(ExamPart.exam_id == exam.exam_id, ExamPart.part_number == 1).first()
    out = ExamProtocolOut.model_validate(protocol)
    out.part1_mode = part1.part_mode if part1 else None
    return out


@router.put("/exams/{exam_id}/protocol", response_model=ExamProtocolOut)
def update_exam_protocol(exam_id: int, data: ExamProtocolUpdate, db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.exam_id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    protocol = db.query(ExamProtocol).filter(ExamProtocol.exam_id == exam.exam_id).first()
    if not protocol:
        protocol = ExamProtocol(exam_id=exam.exam_id)
        db.add(protocol)
    payload = data.model_dump(exclude_unset=True)
    part1_mode = payload.pop("part1_mode", None)
    for field, value in payload.items():
        setattr(protocol, field, value)
    db.commit()
    db.refresh(protocol)
    if part1_mode:
        ensure_exam_parts_for_exam(db, exam)
        part1 = db.query(ExamPart).filter(ExamPart.exam_id == exam.exam_id, ExamPart.part_number == 1).first()
        if part1:
            part1.part_mode = part1_mode
            db.commit()
            db.refresh(part1)
    out = ExamProtocolOut.model_validate(protocol)
    out.part1_mode = part1_mode
    return out


# ==================================================
# Member Grading Sheets (Teil 1)
# ==================================================

@router.get("/exam-parts/{exam_part_id}/my-grading-sheet", response_model=MemberGradingSheetOut)
def get_my_grading_sheet(exam_part_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    sheet = get_or_create_member_sheet(db=db, exam_part_id=exam_part_id, examiner_id=current_user.user_id)
    sheet = db.execute(
        select(ExamGradingSheet)
        .where(ExamGradingSheet.exam_grading_sheet_id == sheet.exam_grading_sheet_id)
        .options(selectinload(ExamGradingSheet.items))
    ).scalar_one()
    return sheet


@router.get("/exam-parts/{exam_part_id}/my-grading-sheet/view", response_model=MemberGradingSheetViewOut)
def get_my_grading_sheet_view_endpoint(exam_part_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return get_member_sheet_view(db=db, exam_part_id=exam_part_id, examiner_id=current_user.user_id)


@router.put("/grading-sheets/{sheet_id}/items")
def update_sheet_items_endpoint(sheet_id: int, payload: GradingSheetUpdateIn, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _ = update_member_sheet(db=db, sheet_id=sheet_id, examiner_id=current_user.user_id, payload=payload)
    return {"status": "ok"}


@router.post("/grading-sheets/{sheet_id}/submit")
def submit_my_sheet_endpoint(sheet_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    sheet, all_submitted = submit_member_sheet(db, sheet_id=sheet_id, examiner_id=current_user.user_id)
    return {"status": "ok", "all_submitted_for_part": all_submitted}


# ==================================================
# Final Grading Sheet
# ==================================================

@router.get("/exam-parts/{exam_part_id}/final-grading-sheet", response_model=FinalSheetOut)
def get_final_sheet_view_endpoint(exam_part_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return build_final_sheet_view(db, exam_part_id=exam_part_id)


@router.put("/exam-parts/{exam_part_id}/final-grading-sheet", response_model=FinalSheetOut)
def update_final_sheet_endpoint(exam_part_id: int, payload: FinalSheetDecisionIn, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _ = save_final_sheet_decisions(db=db, exam_part_id=exam_part_id, decisions=payload)
    return build_final_sheet_view(db, exam_part_id=exam_part_id)

# ==================================================
# ExamPart Timer: Start / Pause / Resume / Stop / Reset
# ==================================================

class ExamPartTimerOut(BaseModel):
    exam_part_id: int
    status: str
    started_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    total_paused_seconds: int = 0
    model_config = ConfigDict(from_attributes=True)


@router.post("/exam-parts/{exam_part_id}/start", response_model=ExamPartTimerOut)
def start_exam_part(
    exam_part_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Startet oder setzt einen pausierten Part fort."""
    part = db.get(ExamPart, exam_part_id)
    if not part:
        raise HTTPException(status_code=404, detail="ExamPart not found")

    # Teil 2: erst starten wenn Teil 1 done
    if part.part_number == 2:
        part1 = db.query(ExamPart).filter(
            ExamPart.exam_id == part.exam_id,
            ExamPart.part_number == 1,
        ).first()
        if part1 and part1.status != "done":
            raise HTTPException(status_code=409, detail="Teil 1 muss zuerst abgeschlossen sein.")

    now = datetime.utcnow()

    if part.status == "paused" and getattr(part, "paused_at", None):
        # Fortsetzen: Pausenzeit akkumulieren
        pause_secs = int((now - part.paused_at).total_seconds())
        part.total_paused_seconds = (part.total_paused_seconds or 0) + pause_secs
        part.paused_at = None
    elif part.status == "planned":
        part.started_at = now
        part.ended_at = None
        part.paused_at = None
        part.total_paused_seconds = 0
    elif part.status != "in_progress":
        raise HTTPException(status_code=409, detail=f"Part cannot be started (status={part.status}).")

    part.status = "in_progress"
    db.commit()
    db.refresh(part)
    return part


@router.post("/exam-parts/{exam_part_id}/pause", response_model=ExamPartTimerOut)
def pause_exam_part(
    exam_part_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Pausiert einen laufenden Part."""
    part = db.get(ExamPart, exam_part_id)
    if not part:
        raise HTTPException(status_code=404, detail="ExamPart not found")
    if part.status != "in_progress":
        raise HTTPException(status_code=409, detail=f"Part cannot be paused (status={part.status}).")

    part.status = "paused"
    part.paused_at = datetime.utcnow()
    db.commit()
    db.refresh(part)
    return part


@router.post("/exam-parts/{exam_part_id}/stop", response_model=ExamPartTimerOut)
def stop_exam_part(
    exam_part_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Beendet einen Part → status=done."""
    part = db.get(ExamPart, exam_part_id)
    if not part:
        raise HTTPException(status_code=404, detail="ExamPart not found")
    if part.status not in ("in_progress", "paused"):
        raise HTTPException(status_code=409, detail=f"Part cannot be stopped (status={part.status}).")

    now = datetime.utcnow()
    if part.status == "paused" and getattr(part, "paused_at", None):
        part.total_paused_seconds = (part.total_paused_seconds or 0) + int((now - part.paused_at).total_seconds())
        part.paused_at = None

    part.status = "done"
    part.ended_at = now
    db.commit()
    db.refresh(part)
    return part


@router.post("/exam-parts/{exam_part_id}/reset", response_model=ExamPartTimerOut)
def reset_exam_part(
    exam_part_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Setzt einen Part komplett zurück."""
    part = db.get(ExamPart, exam_part_id)
    if not part:
        raise HTTPException(status_code=404, detail="ExamPart not found")

    part.status = "planned"
    part.started_at = None
    part.paused_at = None
    part.ended_at = None
    part.total_paused_seconds = 0
    db.commit()
    db.refresh(part)
    return part
