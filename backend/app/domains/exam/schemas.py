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
    grading_area_id: Optional[int] = None


class GradingCriterionUpdate(BaseModel):
    criterion_number: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    max_points: Optional[int] = None
    weight: Optional[float] = None
    is_active: Optional[bool] = None
    grading_area_id: Optional[int] = None


class GradingCriterionOut(GradingCriterionBase):
    grading_criterion_definition_id: int
    grading_area_id: Optional[int] = None

    class Config:
        from_attributes = True  # Pydantic v2


# ---------- Grading Area (Bewertungsbereich) ----------

class GradingAreaBase(BaseModel):
    area_number: int
    title: str
    description: Optional[str] = None
    is_active: bool = True


class GradingAreaCreate(GradingAreaBase):
    pass


class GradingAreaUpdate(BaseModel):
    area_number: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class GradingAreaOut(GradingAreaBase):
    grading_area_id: int
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
    areas: List[GradingAreaOut] = []

    class Config:
        from_attributes = True


# ---------- Expert Discussion Area Definition ----------

from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel

# ...

class ExpertDiscussionAreaBase(BaseModel):
    code: Optional[str] = None
    title: str
    description: Optional[str] = None
    expected_answer: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class ExpertDiscussionAreaCreate(ExpertDiscussionAreaBase):
    pass  # subject_id kommt aus dem Pfad (subjects/{subject_id})


class ExpertDiscussionAreaUpdate(BaseModel):
    code: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    expected_answer: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class ExpertDiscussionAreaOut(ExpertDiscussionAreaBase):
    expert_discussion_area_definition_id: int
    subject_id: int
    created_at: datetime
    updated_at: datetime

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

    part1_mode: Optional[str] = None  # 'presentation' | 'demonstration'


class ExamProtocolOut(ExamProtocolBase):
    exam_protocol_id: int
    exam_id: int
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


# ---------- Expert Discussion Items (Fachgespräch) ----------

class ExpertDiscussionItemBase(BaseModel):
    # optional Verknüpfung auf eine definierte Area (Dropdown)
    expert_discussion_area_definition_id: Optional[int] = None

    # immer gespeicherter Titel (auch wenn Definition später geändert/gelöscht wird)
    area_title: str

    candidate_statement: Optional[str] = None
    examiner_comment: Optional[str] = None

    grade: Optional[float] = None   # Note in Viertelschritten
    points: Optional[float] = None  # optional, berechnet


class ExpertDiscussionItemCreate(ExpertDiscussionItemBase):
    """
    exam_part_id kommt aus dem Pfad (exam-parts/{exam_part_id}).
    """
    pass


class ExpertDiscussionItemUpdate(BaseModel):
    expert_discussion_area_definition_id: Optional[int] = None
    area_title: Optional[str] = None
    candidate_statement: Optional[str] = None
    examiner_comment: Optional[str] = None
    grade: Optional[float] = None
    points: Optional[float] = None


class ExpertDiscussionItemOut(ExpertDiscussionItemBase):
    exam_expert_discussion_item_id: int
    exam_part_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------- Final Sheet ----------

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


# ---------- Updates ----------

class GradingItemUpdateIn(BaseModel):
    exam_grading_item_id: int
    grade: Optional[float] = None
    points: Optional[float] = None
    comment: Optional[str] = None


class GradingSheetUpdateIn(BaseModel):
    items: List[GradingItemUpdateIn]


class FinalCriterionDecisionIn(BaseModel):
    """
    criterion_id == grading_criterion_definition_id
    """
    criterion_id: int
    decided_points: Optional[float] = None
    decided_grade: Optional[float] = None
    combined_comment: Optional[str] = None


class FinalSheetDecisionIn(BaseModel):
    criteria: List[FinalCriterionDecisionIn]

# End of file