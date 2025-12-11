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

# ---------- Exam Protocol ----------

class ExamProtocolBase(BaseModel):
    identity_checked: bool = False
    exam_ability_asked: bool = False
    bias_cleared: bool = False
    guest_examiner_consent: bool = False
    instructions_given: bool = False
    fraud_notice_given: bool = False
    devices_notice_given: bool = False

    precheck_comment: Optional[str] = None

    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class ExamProtocolUpdate(BaseModel):
    # alle Felder optional, damit Partial-Update möglich ist
    identity_checked: Optional[bool] = None
    exam_ability_asked: Optional[bool] = None
    bias_cleared: Optional[bool] = None
    guest_examiner_consent: Optional[bool] = None
    instructions_given: Optional[bool] = None
    fraud_notice_given: Optional[bool] = None
    devices_notice_given: Optional[bool] = None

    precheck_comment: Optional[str] = None

    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    # Auswahl für Teil 1: Präsentation vs. Durchführung
    part1_mode: Optional[str] = None  # 'presentation' | 'demonstration'


class ExamProtocolOut(ExamProtocolBase):
    exam_protocol_id: int
    exam_id: int

    # Für die UI hilfreich: aktuellen Modus von Teil 1 mitliefern
    part1_mode: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Exam Parts für UI ----------

class ExamPartOut(BaseModel):
    exam_part_id: int
    exam_id: int
    part_number: int
    title: str
    part_mode: Optional[str] = None
    weight: float
    status: str
    points: Optional[int] = None
    grade: Optional[float] = None

    class Config:
        from_attributes = True


class ExamWithPartsOut(BaseModel):
    exam_id: int
    exam_type: str
    status: str
    parts: List[ExamPartOut]

# Einzelbewertung eines Prüfers
class MemberRatingOut(BaseModel):
    examiner_id: int
    examiner_name: str
    grade: Optional[float] = None
    points: Optional[float] = None
    comment: Optional[str] = None


class FinalCriterionOut(BaseModel):
    criterion_id: int
    criterion_number: int
    title: str
    description: Optional[str] = None
    max_points: int

    member_ratings: List[MemberRatingOut]

    suggested_points: Optional[float] = None
    suggested_grade: Optional[float] = None

    decided_points: Optional[float] = None
    decided_grade: Optional[float] = None
    combined_comment: Optional[str] = None

    max_grade_diff: Optional[float] = None
    max_points_diff: Optional[float] = None
    has_conflict: bool


class FinalSheetOut(BaseModel):
    exam_part_id: int
    exam_id: int
    part_number: int
    title: str
    status: str
    final_sheet_id: Optional[int] = None
    criteria: List[FinalCriterionOut]


class GradingItemUpdateIn(BaseModel):
    exam_grading_item_id: int
    grade: Optional[float] = None
    points: Optional[float] = None
    comment: Optional[str] = None


class GradingSheetUpdateIn(BaseModel):
    items: List[GradingItemUpdateIn]


class FinalCriterionDecisionIn(BaseModel):
    """
    Eingabe für die finale Entscheidung pro Kriterium.
    criterion_id == grading_criterion_definition_id
    """
    criterion_id: int
    decided_points: Optional[float] = None
    decided_grade: Optional[float] = None
    combined_comment: Optional[str] = None


class FinalSheetDecisionIn(BaseModel):
    """
    Eingabe für den gesamten finalen Bogen eines Prüfungsteils.
    exam_part_id kommt aus dem Path-Parameter, daher hier nicht nötig.
    """
    criteria: List[FinalCriterionDecisionIn]


# End of file