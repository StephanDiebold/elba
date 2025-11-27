# app/domains/exam/router.py
from fastapi import APIRouter, Depends, HTTPException
from typing import List

from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.domains.exam.models import (
    GradingSheetDefinition,
    GradingCriterionGroup,
    GradingCriterionDefinition,
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
)

router = APIRouter(prefix="/admin", tags=["admin-exam-grading"])


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
# End of file