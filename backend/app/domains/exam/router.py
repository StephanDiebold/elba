# app/domains/exam/router.py
from fastapi import APIRouter, Depends, HTTPException
from typing import List

from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.domains.auth.auth import get_current_user
from app.domains.exam.models import (
    GradingSheetDefinition,
    GradingCriterionGroup,
    GradingCriterionDefinition,
    Exam,
    ExamPart,
    ExamProtocol,
    ExamGradingSheet,
)
from app.domains.exam.schemas import (
    GradingSheetDefinitionOut,
    GradingSheetDefinitionCreate,
    GradingSheetDefinitionUpdate,
    GradingCriterionGroupOut,
    GradingCriterionGroupCreate,
    GradingCriterionGroupUpdate,
    GradingCriterionOut,
    GradingCriterionCreate,
    GradingCriterionUpdate,
    ExamProtocolOut,
    ExamProtocolUpdate,
    ExamPartOut,
    ExamWithPartsOut,
    FinalSheetOut,
    GradingSheetUpdateIn,
    FinalSheetDecisionIn
)

from app.domains.exam.services.grading_service import (
    get_or_create_member_sheet,
    update_member_sheet,
    submit_member_sheet,
    build_final_sheet_view,
    save_final_sheet_decisions,
)

from app.domains.exam.services.parts_service import ensure_exam_parts_for_exam

# Der zweite Aufruf überschreibt den ersten – relevant ist "/exam"
# router = APIRouter(prefix="/admin", tags=["admin-exam-grading"])
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


# ---- Groups / Lernbereiche ----


@router.post(
    "/grading-sheets/{grading_sheet_definition_id}/groups",
    response_model=GradingCriterionGroupOut,
    status_code=201,
)
def create_grading_group(
    grading_sheet_definition_id: int,
    data: GradingCriterionGroupCreate,
    db: Session = Depends(get_db),
):
    # optional: prüfen, ob Sheet existiert
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

    group = GradingCriterionGroup(
        grading_sheet_definition_id=grading_sheet_definition_id,
        group_number=data.group_number,
        title=data.title,
        description=data.description,
        is_active=data.is_active,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.put(
    "/grading-groups/{grading_criterion_group_id}",
    response_model=GradingCriterionGroupOut,
)
def update_grading_group(
    grading_criterion_group_id: int,
    data: GradingCriterionGroupUpdate,
    db: Session = Depends(get_db),
):
    group = (
        db.query(GradingCriterionGroup)
        .filter(
            GradingCriterionGroup.grading_criterion_group_id
            == grading_criterion_group_id
        )
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Grading group not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(group, field, value)

    db.commit()
    db.refresh(group)
    return group


# ---- Criteria ----


@router.post(
    "/grading-groups/{grading_criterion_group_id}/criteria",
    response_model=GradingCriterionOut,
    status_code=201,
)
def create_criterion_for_group(
    grading_criterion_group_id: int,
    data: GradingCriterionCreate,
    db: Session = Depends(get_db),
):
    group = (
        db.query(GradingCriterionGroup)
        .filter(
            GradingCriterionGroup.grading_criterion_group_id
            == grading_criterion_group_id
        )
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Grading group not found")

    criterion = GradingCriterionDefinition(
        grading_sheet_definition_id=group.grading_sheet_definition_id,
        grading_criterion_group_id=grading_criterion_group_id,
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

    # wenn Gruppe geändert wird, sheet_id nachziehen
    if "grading_criterion_group_id" in payload:
        new_group_id = payload["grading_criterion_group_id"]
        if new_group_id is not None:
            group = (
                db.query(GradingCriterionGroup)
                .filter(
                    GradingCriterionGroup.grading_criterion_group_id == new_group_id
                )
                .first()
            )
            if not group:
                raise HTTPException(status_code=404, detail="Target group not found")
            criterion.grading_sheet_definition_id = group.grading_sheet_definition_id

    for field, value in payload.items():
        setattr(criterion, field, value)

    db.commit()
    db.refresh(criterion)
    return criterion


# ---- Exam Parts & Protocol ----


@router.get("/exams/{exam_id}/parts", response_model=ExamWithPartsOut)
def get_exam_with_parts(
    exam_id: int,
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.exam_id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # sicherstellen, dass für AEVO etc. die Teile angelegt sind
    ensure_exam_parts_for_exam(db, exam)

    parts = (
        db.query(ExamPart)
        .filter(ExamPart.exam_id == exam.exam_id)
        .order_by(ExamPart.part_number)
        .all()
    )

    return ExamWithPartsOut(
        exam_id=exam.exam_id,
        exam_type=exam.exam_type,
        status=exam.status,
        parts=parts,
    )


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


# ---- Member Grading Sheets ----


@router.get(
    "/exam-parts/{exam_part_id}/my-grading-sheet",
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
    # TODO: eigenes Out-Schema bauen – aktuell raw SQLAlchemy-Objekt
    return sheet


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


# End of file
