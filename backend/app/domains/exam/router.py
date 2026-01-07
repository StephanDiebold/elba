# app/domains/exam/router.py
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Literal

from sqlalchemy.orm import Session, selectinload

from sqlalchemy import select
from datetime import datetime

from app.core.deps import get_db
from app.domains.auth.auth import get_current_user
from app.domains.exam.models import (
    GradingSheetDefinition,
    GradingArea,
    GradingCriterionDefinition,
    Exam,
    ExamPart,
    ExamProtocol,
    ExamGradingSheet,
    ExamGradingItem,
    ExpertDiscussionAreaDefinition,
    ExamExpertDiscussionItem,
    ExamCheckin,
)
from app.domains.exam.schemas import (
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
    ExamPartOut,
    ExamStartIn,
    ExamStartOut,
    ExamWithPartsOut,
    FinalSheetOut,
    GradingSheetUpdateIn,
    FinalSheetDecisionIn,
    ExpertDiscussionAreaOut,
    ExpertDiscussionAreaCreate,
    ExpertDiscussionAreaUpdate,
    ExpertDiscussionItemOut,
    ExpertDiscussionItemCreate,
    ExpertDiscussionItemUpdate,
    MemberGradingSheetOut,
    MemberGradingSheetViewOut,
)

from app.domains.exam.services.grading_service import (
    get_or_create_member_sheet,
    update_member_sheet,
    submit_member_sheet,
    build_final_sheet_view,
    save_final_sheet_decisions,
    get_member_sheet_view,
)

from app.domains.exam.services.parts_service import ensure_exam_parts_for_exam

router = APIRouter(prefix="/exam", tags=["exam"])

# ---- Grading Sheet Definitions ----

@router.get(
    "/subjects/{subject_id}/grading-sheets",
    response_model=List[GradingSheetDefinitionOut],
)
def list_grading_sheets_for_subject(
    subject_id: int,
    db: Session = Depends(get_db),
):
    sheets = (
        db.query(GradingSheetDefinition)
        .filter(GradingSheetDefinition.subject_id == subject_id)
        .order_by(
            GradingSheetDefinition.part_number,
            GradingSheetDefinition.version_no.desc(),
        )
        .all()
    )
    return sheets


@router.post(
    "/subjects/{subject_id}/grading-sheets",
    response_model=GradingSheetDefinitionOut,
    status_code=201,
)
def create_grading_sheet_definition(
    subject_id: int,
    data: GradingSheetDefinitionCreate,
    db: Session = Depends(get_db),
):
    sheet = GradingSheetDefinition(
        subject_id=subject_id,
        part_number=data.part_number,
        title=data.title,
        version_no=data.version_no,
        is_active=data.is_active,
        valid_from=data.valid_from,
        valid_to=data.valid_to,
    )
    db.add(sheet)
    db.commit()
    db.refresh(sheet)
    return sheet


@router.get(
    "/grading-sheets/{grading_sheet_definition_id}",
    response_model=GradingSheetDefinitionOut,
)
def get_grading_sheet_definition(
    grading_sheet_definition_id: int,
    db: Session = Depends(get_db),
):
    sheet = (
        db.query(GradingSheetDefinition)
        .filter(
            GradingSheetDefinition.grading_sheet_definition_id
            == grading_sheet_definition_id
        )
        .first()
    )
    if not sheet:
        raise HTTPException(status_code=404, detail="Grading sheet not found")
    return sheet


@router.put(
    "/grading-sheets/{grading_sheet_definition_id}",
    response_model=GradingSheetDefinitionOut,
)
def update_grading_sheet_definition(
    grading_sheet_definition_id: int,
    data: GradingSheetDefinitionUpdate,
    db: Session = Depends(get_db),
):
    sheet = (
        db.query(GradingSheetDefinition)
        .filter(
            GradingSheetDefinition.grading_sheet_definition_id
            == grading_sheet_definition_id
        )
        .first()
    )
    if not sheet:
        raise HTTPException(status_code=404, detail="Grading sheet not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(sheet, field, value)

    db.commit()
    db.refresh(sheet)
    return sheet


# ---- Areas / Bewertungsbereiche ----

@router.post(
    "/grading-sheets/{grading_sheet_definition_id}/areas",
    response_model=GradingAreaOut,
    status_code=201,
)
def create_grading_area(
    grading_sheet_definition_id: int,
    data: GradingAreaCreate,
    db: Session = Depends(get_db),
):
    sheet = (
        db.query(GradingSheetDefinition)
        .filter(
            GradingSheetDefinition.grading_sheet_definition_id
            == grading_sheet_definition_id
        )
        .first()
    )
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


@router.put(
    "/grading-areas/{grading_area_id}",
    response_model=GradingAreaOut,
)
def update_grading_area(
    grading_area_id: int,
    data: GradingAreaUpdate,
    db: Session = Depends(get_db),
):
    area = (
        db.query(GradingArea)
        .filter(GradingArea.grading_area_id == grading_area_id)
        .first()
    )
    if not area:
        raise HTTPException(status_code=404, detail="Grading area not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(area, field, value)

    db.commit()
    db.refresh(area)
    return area


# ---- Criteria ----

@router.post(
    "/grading-areas/{grading_area_id}/criteria",
    response_model=GradingCriterionOut,
    status_code=201,
)
def create_criterion_for_area(
    grading_area_id: int,
    data: GradingCriterionCreate,
    db: Session = Depends(get_db),
):
    area = (
        db.query(GradingArea)
        .filter(GradingArea.grading_area_id == grading_area_id)
        .first()
    )
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


@router.put(
    "/grading-criteria/{grading_criterion_definition_id}",
    response_model=GradingCriterionOut,
)
def update_criterion(
    grading_criterion_definition_id: int,
    data: GradingCriterionUpdate,
    db: Session = Depends(get_db),
):
    criterion = (
        db.query(GradingCriterionDefinition)
        .filter(
            GradingCriterionDefinition.grading_criterion_definition_id
            == grading_criterion_definition_id
        )
        .first()
    )
    if not criterion:
        raise HTTPException(status_code=404, detail="Criterion not found")

    payload = data.model_dump(exclude_unset=True)

    if "grading_area_id" in payload:
        new_area_id = payload["grading_area_id"]
        if new_area_id is not None:
            area = (
                db.query(GradingArea)
                .filter(GradingArea.grading_area_id == new_area_id)
                .first()
            )
            if not area:
                raise HTTPException(status_code=404, detail="Target area not found")
            criterion.grading_sheet_definition_id = area.grading_sheet_definition_id

    for field, value in payload.items():
        setattr(criterion, field, value)

    db.commit()
    db.refresh(criterion)
    return criterion

# ---- Expert Discussion Area Definitions (Fachgespräch-Vorlagen) ----


@router.get(
    "/subjects/{subject_id}/expert-discussion-areas",
    response_model=List[ExpertDiscussionAreaOut],
)
def list_expert_discussion_areas_for_subject(
    subject_id: int,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(ExpertDiscussionAreaDefinition).filter(
        ExpertDiscussionAreaDefinition.subject_id == subject_id
    )
    if not include_inactive:
        query = query.filter(ExpertDiscussionAreaDefinition.is_active == True)

    areas = query.order_by(
        ExpertDiscussionAreaDefinition.sort_order,
        ExpertDiscussionAreaDefinition.title,
    ).all()
    return areas


@router.post(
    "/subjects/{subject_id}/expert-discussion-areas",
    response_model=ExpertDiscussionAreaOut,
    status_code=201,
)
def create_expert_discussion_area(
    subject_id: int,
    data: ExpertDiscussionAreaCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    area = ExpertDiscussionAreaDefinition(
        subject_id=subject_id,
        code=data.code,
        title=data.title,
        description=data.description,
        expected_answer=data.expected_answer,
        sort_order=data.sort_order,
        is_active=data.is_active,
    )
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@router.put(
    "/expert-discussion-areas/{area_id}",
    response_model=ExpertDiscussionAreaOut,
)
def update_expert_discussion_area(
    area_id: int,
    data: ExpertDiscussionAreaUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    area = (
        db.query(ExpertDiscussionAreaDefinition)
        .filter(
            ExpertDiscussionAreaDefinition.expert_discussion_area_definition_id
            == area_id
        )
        .first()
    )
    if not area:
        raise HTTPException(status_code=404, detail="Expert discussion area not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(area, field, value)

    db.commit()
    db.refresh(area)
    return area


# ---- Exam Parts & Protocol ----


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
        started_at=getattr(exam, "started_at", None),
        attendance_status=getattr(exam, "attendance_status", None),
        part1_mode=(part1.part_mode if part1 else None),
        parts=parts,
    )

@router.get("/exams/{exam_id}/checkin", response_model=ExamCheckinOut)
def get_exam_checkin(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
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
def update_exam_checkin(
    exam_id: int,
    data: ExamCheckinUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    exam = db.query(Exam).filter(Exam.exam_id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    checkin = db.query(ExamCheckin).filter(ExamCheckin.exam_id == exam_id).first()
    if not checkin:
        checkin = ExamCheckin(exam_id=exam_id)
        db.add(checkin)

    payload = data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        setattr(checkin, field, value)

    db.commit()
    db.refresh(checkin)
    return checkin


@router.get("/exams/{exam_id}/protocol", response_model=ExamProtocolOut)
def get_exam_protocol(
    exam_id: int,
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.exam_id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    protocol = (
        db.query(ExamProtocol)
        .filter(ExamProtocol.exam_id == exam.exam_id)
        .first()
    )
    if not protocol:
        protocol = ExamProtocol(exam_id=exam.exam_id)
        db.add(protocol)
        db.commit()
        db.refresh(protocol)

    # part_mode von Teil 1 für die Ausgabe mitziehen
    part1 = (
        db.query(ExamPart)
        .filter(ExamPart.exam_id == exam.exam_id, ExamPart.part_number == 1)
        .first()
    )
    out = ExamProtocolOut.model_validate(protocol)
    out.part1_mode = part1.part_mode if part1 else None
    return out


@router.put("/exams/{exam_id}/protocol", response_model=ExamProtocolOut)
def update_exam_protocol(
    exam_id: int,
    data: ExamProtocolUpdate,
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.exam_id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    protocol = (
        db.query(ExamProtocol)
        .filter(ExamProtocol.exam_id == exam.exam_id)
        .first()
    )
    if not protocol:
        protocol = ExamProtocol(exam_id=exam.exam_id)
        db.add(protocol)

    # Partial-Update der Protokollfelder
    payload = data.model_dump(exclude_unset=True)
    part1_mode = payload.pop("part1_mode", None)  # separat behandeln

    for field, value in payload.items():
        setattr(protocol, field, value)

    db.commit()
    db.refresh(protocol)

    # Falls part1_mode gesetzt ist: Teil 1 anlegen/aktualisieren
    if part1_mode:
        ensure_exam_parts_for_exam(db, exam)
        part1 = (
            db.query(ExamPart)
            .filter(ExamPart.exam_id == exam.exam_id, ExamPart.part_number == 1)
            .first()
        )
        if part1:
            part1.part_mode = part1_mode
            db.commit()
            db.refresh(part1)

    # Ausgabe vorbereiten inkl. part1_mode
    out = ExamProtocolOut.model_validate(protocol)
    out.part1_mode = part1_mode or getattr(
        db.query(ExamPart)
        .filter(ExamPart.exam_id == exam.exam_id, ExamPart.part_number == 1)
        .first(),
        "part_mode",
        None,
    )
    return out

# ---- Expert Discussion Items (Fachgespräch / Protokollzeilen) ----


@router.get(
    "/exam-parts/{exam_part_id}/expert-discussion-items",
    response_model=List[ExpertDiscussionItemOut],
)
def list_expert_discussion_items(
    exam_part_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    items = (
        db.query(ExamExpertDiscussionItem)
        .filter(ExamExpertDiscussionItem.exam_part_id == exam_part_id)
        .order_by(ExamExpertDiscussionItem.exam_expert_discussion_item_id)
        .all()
    )
    return items


@router.post(
    "/exam-parts/{exam_part_id}/expert-discussion-items",
    response_model=ExpertDiscussionItemOut,
    status_code=201,
)
def create_expert_discussion_item(
    exam_part_id: int,
    data: ExpertDiscussionItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Optional: prüfen, ob exam_part existiert
    part = db.query(ExamPart).filter(ExamPart.exam_part_id == exam_part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Exam part not found")

    item = ExamExpertDiscussionItem(
        exam_part_id=exam_part_id,
        expert_discussion_area_definition_id=data.expert_discussion_area_definition_id,
        area_title=data.area_title,
        candidate_statement=data.candidate_statement,
        examiner_comment=data.examiner_comment,
        grade=data.grade,
        points=data.points,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put(
    "/expert-discussion-items/{item_id}",
    response_model=ExpertDiscussionItemOut,
)
def update_expert_discussion_item(
    item_id: int,
    data: ExpertDiscussionItemUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = (
        db.query(ExamExpertDiscussionItem)
        .filter(ExamExpertDiscussionItem.exam_expert_discussion_item_id == item_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Expert discussion item not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete(
    "/expert-discussion-items/{item_id}",
    status_code=204,
)
def delete_expert_discussion_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = (
        db.query(ExamExpertDiscussionItem)
        .filter(ExamExpertDiscussionItem.exam_expert_discussion_item_id == item_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Expert discussion item not found")

    db.delete(item)
    db.commit()
    return


# ---- Member Grading Sheets ----


@router.get(
    "/exam-parts/{exam_part_id}/my-grading-sheet",
    response_model=MemberGradingSheetOut,
)
def get_my_grading_sheet(
    exam_part_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sheet = get_or_create_member_sheet(
        db=db,
        exam_part_id=exam_part_id,
        examiner_id=current_user.user_id,
    )

    # ✅ WICHTIG: sheet inkl. items sauber neu laden (eager)
    sheet = db.execute(
        select(ExamGradingSheet)
        .where(ExamGradingSheet.exam_grading_sheet_id == sheet.exam_grading_sheet_id)
        .options(selectinload(ExamGradingSheet.items))
    ).scalar_one()

    return sheet

@router.get(
    "/exam-parts/{exam_part_id}/my-grading-sheet/view",
    response_model=MemberGradingSheetViewOut,
)
def get_my_grading_sheet_view(
    exam_part_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return get_member_sheet_view(
        db=db,
        exam_part_id=exam_part_id,
        examiner_id=current_user.user_id,
    )

@router.put("/grading-sheets/{sheet_id}/items")
def update_sheet_items_endpoint(
    sheet_id: int,
    payload: GradingSheetUpdateIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Aktualisiert ein Member-Sheet des aktuellen Prüfers.
    Nutzt update_member_sheet() aus grading_service.
    """
    # Service kümmert sich um Ownership- und Typ-Check (member sheet)
    _ = update_member_sheet(
        db=db,
        sheet_id=sheet_id,
        examiner_id=current_user.user_id,
        payload=payload,
    )
    return {"status": "ok"}


@router.post("/grading-sheets/{sheet_id}/submit")
def submit_my_sheet(
    sheet_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        sheet, all_submitted = submit_member_sheet(
            db, sheet_id=sheet_id, examiner_id=current_user.user_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"status": "ok", "all_submitted_for_part": all_submitted}


# ---- Final Grading Sheet (Ausschuss) ----


@router.get(
    "/exam-parts/{exam_part_id}/final-grading-sheet",
    response_model=FinalSheetOut,
)
def get_final_sheet_view(
    exam_part_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        data = build_final_sheet_view(db, exam_part_id=exam_part_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return data

@router.put(
    "/exam-parts/{exam_part_id}/final-grading-sheet",
    response_model=FinalSheetOut,
)
def update_final_sheet(
    exam_part_id: int,
    payload: FinalSheetDecisionIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Schreibt die final beschlossenen Punkte/Noten/Kommentare in den
    Ausschuss-Bogen (sheet_type='final') und gibt den aggregierten View zurück.

    TODO (später): Rollen-Check (z. B. nur Vorsitz / berechtigte Prüfer).
    """
    try:
        _ = save_final_sheet_decisions(
            db=db,
            exam_part_id=exam_part_id,
            decisions=payload,
        )
        data = build_final_sheet_view(db, exam_part_id=exam_part_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return data

@router.post("/exams/{exam_id}/start", response_model=ExamStartOut)
def start_exam(
    exam_id: int,
    payload: ExamStartIn,   # body required
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        exam = db.execute(
            select(Exam).where(Exam.exam_id == exam_id).with_for_update()
        ).scalar_one_or_none()

        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")

        if exam.status in ("done", "canceled"):
            raise HTTPException(
                status_code=409,
                detail=f"Exam cannot be started (status={exam.status})."
            )

        # started_at setzen
        if exam.started_at is None:
            exam.started_at = datetime.utcnow()

        # status setzen
        if exam.status == "planned":
            exam.status = "in_progress"

        # attendance_status: beim Start default auf present setzen (wenn leer)
        if exam.attendance_status is None:
            exam.attendance_status = "present"

        # checkin upsert (idempotent)
        checkin = db.get(ExamCheckin, exam_id)
        if checkin is None:
            db.add(ExamCheckin(exam_id=exam_id))

        # Parts sicherstellen (idempotent)
        ensure_exam_parts_for_exam(db, exam)
        db.flush()  # 👈 wichtig, damit newly created parts jetzt sichtbar sind

        # Teil 1 holen
        part1 = db.execute(
            select(ExamPart).where(
                ExamPart.exam_id == exam.exam_id,
                ExamPart.part_number == 1
            )
        ).scalar_one_or_none()

        # part_mode setzen, falls mitgegeben
        if payload.part1_mode:
            if part1 is None:
                raise HTTPException(status_code=500, detail="Part 1 not found after ensure_exam_parts_for_exam")
            part1.part_mode = payload.part1_mode

        db.commit()

        # neu laden (damit Response garantiert DB-Stand ist)
        db.refresh(exam)
        if part1:
            db.refresh(part1)

        return ExamStartOut(
            exam_id=exam.exam_id,
            status=exam.status,
            started_at=exam.started_at,
            attendance_status=exam.attendance_status,
            part1_mode=(part1.part_mode if part1 else None),
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"start_exam failed: {str(e)}")


# End of file
