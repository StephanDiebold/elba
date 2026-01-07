# app/domains/exam/schemas.py

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# Grading Sheet Definitions / Areas / Criteria (Admin)
# =============================================================================

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
    model_config = ConfigDict(from_attributes=True)


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
    criteria: List[GradingCriterionOut] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


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
    areas: List[GradingAreaOut] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Expert Discussion Area Definitions (Fachgespräch-Vorlagen)
# =============================================================================

class ExpertDiscussionAreaBase(BaseModel):
    code: Optional[str] = None
    title: str
    description: Optional[str] = None
    expected_answer: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class ExpertDiscussionAreaCreate(ExpertDiscussionAreaBase):
    # subject_id kommt aus dem Pfad (subjects/{subject_id})
    pass


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
    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Exam Protocol
# =============================================================================

class ExamProtocolBase(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class ExamProtocolUpdate(ExamProtocolBase):
    # wird in router separat behandelt/gespeichert über ExamPart.part_mode
    part1_mode: Optional[str] = None  # "presentation" | "demonstration"


class ExamProtocolOut(ExamProtocolBase):
    exam_protocol_id: int
    exam_id: int
    part1_mode: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Exam Check-in
# =============================================================================

class ExamCheckinBase(BaseModel):
    identity_checked: bool = False
    fit_for_exam_confirmed: bool = False
    conflict_of_interest_cleared: bool = False
    procedure_info_given: bool = False
    phone_notice_given: bool = False

    guest_observer_consent: Optional[bool] = None
    notes: Optional[str] = None


class ExamCheckinUpdate(BaseModel):
    identity_checked: Optional[bool] = None
    fit_for_exam_confirmed: Optional[bool] = None
    conflict_of_interest_cleared: Optional[bool] = None
    procedure_info_given: Optional[bool] = None
    phone_notice_given: Optional[bool] = None

    guest_observer_consent: Optional[bool] = None
    notes: Optional[str] = None


class ExamCheckinOut(ExamCheckinBase):
    exam_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Exam Parts / Exam With Parts (für UI)
# =============================================================================

Part1Mode = Literal["presentation", "demonstration"]
AttendanceStatus = Literal["present", "no_show_excused", "no_show_unexcused"]


class ExamPartOut(BaseModel):
    exam_part_id: int
    exam_id: int
    part_number: int
    title: str
    part_mode: Optional[str] = None
    weight: float
    status: str
    points: Optional[float] = None
    grade: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)


class ExamWithPartsOut(BaseModel):
    exam_id: int
    exam_type: str
    status: str

    started_at: Optional[datetime] = None
    attendance_status: Optional[str] = None
    part1_mode: Optional[Part1Mode] = None

    parts: List[ExamPartOut] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Expert Discussion Items (Fachgespräch / Protokollzeilen)
# =============================================================================

class ExpertDiscussionItemBase(BaseModel):
    expert_discussion_area_definition_id: Optional[int] = None
    area_title: str

    candidate_statement: Optional[str] = None
    examiner_comment: Optional[str] = None

    grade: Optional[float] = None
    points: Optional[float] = None


class ExpertDiscussionItemCreate(ExpertDiscussionItemBase):
    # exam_part_id kommt aus dem Pfad
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
    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Member Grading Sheet (raw)
# =============================================================================

class MemberGradingItemOut(BaseModel):
    exam_grading_item_id: int
    exam_grading_sheet_id: int
    grading_criterion_definition_id: int
    grade: Optional[float] = None
    points: Optional[float] = None
    comment: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class MemberGradingSheetOut(BaseModel):
    exam_grading_sheet_id: int
    exam_part_id: int
    examiner_id: int
    sheet_type: str
    status: str
    items: List[MemberGradingItemOut] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Member Grading Sheet VIEW (grouped by grading_area)
# =============================================================================

class MemberCriterionItemOut(BaseModel):
    exam_grading_item_id: int
    grading_criterion_definition_id: int

    criterion_number: int
    criterion_title: str
    criterion_description: Optional[str] = None
    max_points: int

    grade: Optional[float] = None
    points: Optional[float] = None
    comment: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MemberAreaOut(BaseModel):
    grading_area_id: int
    area_number: int
    title: str
    description: Optional[str] = None

    criteria: List[MemberCriterionItemOut] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class MemberGradingSheetViewOut(BaseModel):
    exam_grading_sheet_id: int
    exam_part_id: int
    examiner_id: int
    sheet_type: str
    status: str

    areas: List[MemberAreaOut] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Final Sheet (Ausschuss)
# =============================================================================

class MemberRatingOut(BaseModel):
    examiner_id: int
    examiner_name: str
    grade: Optional[float] = None
    points: Optional[float] = None
    comment: Optional[str] = None


class FinalCriterionOut(BaseModel):
    criterion_id: int  # == grading_criterion_definition_id
    criterion_number: int
    title: str
    description: Optional[str] = None
    max_points: int

    member_ratings: List[MemberRatingOut] = Field(default_factory=list)

    suggested_points: Optional[float] = None
    suggested_grade: Optional[float] = None

    decided_points: Optional[float] = None
    decided_grade: Optional[float] = None
    combined_comment: Optional[str] = None

    max_grade_diff: Optional[float] = None
    max_points_diff: Optional[float] = None
    has_conflict: bool = False


class FinalSheetOut(BaseModel):
    exam_part_id: int
    exam_id: int
    part_number: int
    title: str
    status: str
    final_sheet_id: Optional[int] = None
    criteria: List[FinalCriterionOut] = Field(default_factory=list)


# =============================================================================
# Updates (Member Sheet + Final Decisions)
# =============================================================================

class GradingItemUpdateIn(BaseModel):
    exam_grading_item_id: int
    grade: Optional[float] = None
    points: Optional[float] = None
    comment: Optional[str] = None


class GradingSheetUpdateIn(BaseModel):
    items: List[GradingItemUpdateIn] = Field(default_factory=list)


class FinalCriterionDecisionIn(BaseModel):
    # criterion_id == grading_criterion_definition_id
    criterion_id: int
    decided_points: Optional[float] = None
    decided_grade: Optional[float] = None
    combined_comment: Optional[str] = None


class FinalSheetDecisionIn(BaseModel):
    criteria: List[FinalCriterionDecisionIn] = Field(default_factory=list)


# =============================================================================
# Exam Start
# =============================================================================

class ExamStartIn(BaseModel):
    part1_mode: Optional[Part1Mode] = None


class ExamStartOut(BaseModel):
    exam_id: int
    status: str
    started_at: Optional[datetime] = None
    attendance_status: Optional[str] = None
    part1_mode: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# End of file