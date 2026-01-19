# backend/app/domains/exam/schemas_expert_discussion.py

from __future__ import annotations
from typing import List, Optional, Literal
from pydantic import BaseModel, ConfigDict


ExpertDiscussionMode = Literal["grades", "points"]


# ==================================================
# V1 - "View" (alte Struktur: flache Items)
# ==================================================

class ExpertDiscussionItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    exam_expert_discussion_item_id: int
    exam_part_id: int
    expert_discussion_area_definition_id: Optional[int] = None

    area_title: str
    description: Optional[str] = None
    expected_answer: Optional[str] = None

    candidate_statement: Optional[str] = None
    examiner_comment: Optional[str] = None

    grade: Optional[float] = None
    points: Optional[float] = None


class ExpertDiscussionViewOut(BaseModel):
    exam_part_id: int
    exam_id: int
    subject_id: int
    mode: ExpertDiscussionMode
    items: List[ExpertDiscussionItemOut]


class ExpertDiscussionItemUpdateIn(BaseModel):
    exam_expert_discussion_item_id: int

    candidate_statement: Optional[str] = None
    examiner_comment: Optional[str] = None
    grade: Optional[float] = None
    points: Optional[float] = None

    # optional future
    area_title: Optional[str] = None
    expert_discussion_area_definition_id: Optional[int] = None


class ExpertDiscussionItemsUpdateIn(BaseModel):
    mode: ExpertDiscussionMode
    items: List[ExpertDiscussionItemUpdateIn]


# ==================================================
# Definitions
# ==================================================

class ExpertDiscussionItemDefinitionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    expert_discussion_item_definition_id: int
    expert_discussion_area_definition_id: int
    code: Optional[str] = None
    title: str
    description: Optional[str] = None
    sort_order: int
    is_active: bool


# ==================================================
# Exam Instances (V2)
# ==================================================

class ExamExpertDiscussionItemAnswerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    exam_expert_discussion_item_answer_id: int
    exam_expert_discussion_area_id: int

    expert_discussion_item_definition_id: Optional[int] = None
    question_text: Optional[str] = None

    answer_text: Optional[str] = None
    examiner_comment: Optional[str] = None

    sort_order: int


class ExamExpertDiscussionAreaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    exam_expert_discussion_area_id: int
    exam_part_id: int
    expert_discussion_area_definition_id: int
    area_title: str

    points_100: Optional[float] = None
    grade: Optional[float] = None

    items: List[ExamExpertDiscussionItemAnswerOut] = []


class ExamExpertDiscussionAreaCreateIn(BaseModel):
    expert_discussion_area_definition_id: int
    area_title: Optional[str] = None  # wenn None -> Titel aus Definition


class ExamExpertDiscussionAreaUpdateIn(BaseModel):
    area_title: Optional[str] = None
    points_100: Optional[float] = None
    grade: Optional[float] = None


class ExamExpertDiscussionItemAnswerCreateIn(BaseModel):
    expert_discussion_item_definition_id: Optional[int] = None
    question_text: Optional[str] = None
    answer_text: Optional[str] = None
    examiner_comment: Optional[str] = None


class ExamExpertDiscussionItemAnswerUpdateIn(BaseModel):
    expert_discussion_item_definition_id: Optional[int] = None
    question_text: Optional[str] = None
    answer_text: Optional[str] = None
    examiner_comment: Optional[str] = None
    sort_order: Optional[int] = None

# End of backend/app/domains/exam/schemas_expert_discussion.py
