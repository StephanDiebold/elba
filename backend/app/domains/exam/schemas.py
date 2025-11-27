# app/domains/exam/schemas.py
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel


# ---------- Criterion ----------

class GradingCriterionBase(BaseModel):
    criterion_number: int
    title: str
    description: Optional[str] = None
    max_points: int
    weight: Optional[float] = None
    is_active: bool = True


class GradingCriterionCreate(GradingCriterionBase):
    grading_criterion_group_id: Optional[int] = None


class GradingCriterionUpdate(BaseModel):
    criterion_number: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    max_points: Optional[int] = None
    weight: Optional[float] = None
    is_active: Optional[bool] = None
    grading_criterion_group_id: Optional[int] = None


class GradingCriterionOut(GradingCriterionBase):
    grading_criterion_definition_id: int
    grading_criterion_group_id: Optional[int] = None

    class Config:
        from_attributes = True  # Pydantic v2


# ---------- Group (Lernbereich) ----------

class GradingCriterionGroupBase(BaseModel):
    group_number: int
    title: str
    description: Optional[str] = None
    is_active: bool = True


class GradingCriterionGroupCreate(GradingCriterionGroupBase):
    pass


class GradingCriterionGroupUpdate(BaseModel):
    group_number: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class GradingCriterionGroupOut(GradingCriterionGroupBase):
    grading_criterion_group_id: int
    criteria: List[GradingCriterionOut] = []

    class Config:
        from_attributes = True


# ---------- Grading Sheet Definition ----------

class GradingSheetDefinitionBase(BaseModel):
    subject_id: int
    part_number: int
    title: str
    version_no: int = 1
    is_active: bool = True
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class GradingSheetDefinitionCreate(GradingSheetDefinitionBase):
    pass


class GradingSheetDefinitionUpdate(BaseModel):
    title: Optional[str] = None
    is_active: Optional[bool] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class GradingSheetDefinitionOut(GradingSheetDefinitionBase):
    grading_sheet_definition_id: int
    created_at: datetime
    updated_at: datetime
    groups: List[GradingCriterionGroupOut] = []

    class Config:
        from_attributes = True
# End of file