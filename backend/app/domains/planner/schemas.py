# app/domains/planner/schemas.py

from datetime import date, time
from typing import Optional, List, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# -------------------------------------------------------------------
# Common Enums
# -------------------------------------------------------------------

ExamDayStatus = Literal["planned", "in_progress", "done", "canceled"]
SlotStatus = Literal["free", "reserved", "booked", "blocked"]
ExamType = Literal["aevo", "wfw", "it", "custom"]
ExamStatus = Literal["planned", "in_progress", "done", "canceled", "no_show"]


# -------------------------------------------------------------------
# Exam Day
# -------------------------------------------------------------------

class ExamDayBase(BaseModel):
    org_unit_id: int
    subject_id: int
    time_scheme_id: Optional[int] = None  # optional → Default wird backendseitig ermittelt
    date: date
    location: Optional[str] = None
    default_room: Optional[str] = None
    status: ExamDayStatus = "planned"
    is_active: bool = True


class ExamDayCreate(ExamDayBase):
    """Payload zum Anlegen eines Prüfungstags."""
    pass


class ExamDayOut(ExamDayBase):
    exam_day_id: int
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------------
# Teams (UI: "Ausschüsse")
# -------------------------------------------------------------------

class ExamDayTeamMemberOut(BaseModel):
    user_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    model_config = ConfigDict(from_attributes=True)


class ExamDayTeamCreate(BaseModel):
    name: Optional[str] = None
    time_scheme_id: Optional[int] = None
    user_ids: List[int]  # exakt 3 Prüfer


class ExamDayTeamUpdate(BaseModel):
    name: Optional[str] = None
    time_scheme_id: Optional[int] = None


class ExamDayTeamOut(BaseModel):
    exam_day_team_id: int
    exam_day_id: int
    name: str
    time_scheme_id: Optional[int] = None
    time_scheme_name: Optional[str] = None

    members: List[ExamDayTeamMemberOut] = Field(default_factory=list)

    slot_count: int = 0
    exam_count: int = 0
    can_delete: bool = True

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------------
# Slots
# -------------------------------------------------------------------

class ExamSlotOut(BaseModel):
    exam_slot_id: int
    exam_day_id: int
    exam_day_team_id: Optional[int] = None

    slot_index: int
    start_time: time
    end_time: time
    status: SlotStatus

    exam_id: Optional[int] = None
    candidate_id: Optional[int] = None
    candidate_first_name: Optional[str] = None
    candidate_last_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------------
# Exams (Prüfungen)
# -------------------------------------------------------------------

class ExamCreate(BaseModel):
    candidate_id: int
    exam_day_id: int
    exam_slot_id: int
    exam_type: ExamType = "aevo"


class ExamOut(BaseModel):
    exam_id: int
    candidate_id: int
    exam_day_id: int
    exam_slot_id: int
    exam_day_team_id: Optional[int] = None
    exam_type: ExamType
    status: ExamStatus

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------------
# Candidates
# -------------------------------------------------------------------

class CandidateBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_active: bool = True


class CandidateCreate(CandidateBase):
    pass


class CandidateUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class CandidateOut(CandidateBase):
    candidate_id: int
    model_config = ConfigDict(from_attributes=True)


# End of file
