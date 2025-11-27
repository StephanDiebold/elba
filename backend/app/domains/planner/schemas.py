# app/domains/planner/schemas.py

from datetime import date, time
from typing import Literal, Optional, List
from pydantic import BaseModel, EmailStr


ExamDayStatus = Literal["planned", "in_progress", "done", "canceled"]
SlotStatus = Literal["free", "reserved", "booked", "blocked"]



class ExamDayBase(BaseModel):
    org_unit_id: int
    subject_id: int
    time_scheme_id: int
    date: date
    location: str | None = None
    default_room: str | None = None
    status: ExamDayStatus = "planned"
    is_active: bool = True

class ExamDayCreate(ExamDayBase):
  """Payload für das Anlegen eines Prüfungstags."""
  # aktuell identisch zu ExamDayBase – kann später bei Bedarf eingeschränkt werden
  pass

class ExamDayOut(ExamDayBase):
    exam_day_id: int

    class Config:
        from_attributes = True  # Pydantic v2: erlaubt ORM-Objekte

class ExamDayCommitteeCreate(BaseModel):
    committee_id: int
    room: str | None = None
    location: str | None = None
    time_scheme_id: int

class ExamDayCommitteeOut(ExamDayCommitteeCreate):
    exam_day_committee_id: int

SlotStatus = Literal["free", "reserved", "booked", "blocked"]

class ExamSlotOut(BaseModel):
    exam_slot_id: int
    exam_day_id: int
    committee_id: int
    slot_index: int
    start_time: time
    end_time: time
    status: SlotStatus

    exam_id: Optional[int] = None
    candidate_id: Optional[int] = None
    candidate_first_name: Optional[str] = None
    candidate_last_name: Optional[str] = None

    class Config:
        from_attributes = True

# -----------------------------
# Exams (Prüfungen)
# -----------------------------

ExamType = Literal["aevo", "wfw", "it", "custom"]
ExamStatus = Literal["planned", "in_progress", "done", "canceled", "no_show"]


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
    committee_id: int
    exam_type: ExamType
    status: ExamStatus

    class Config:
        orm_mode = True


# Optional: Slot-Ausgabe um exam_id ergänzen (hilft später im Frontend)
class ExamSlotOut(BaseModel):
    exam_slot_id: int
    exam_day_id: int
    committee_id: int
    slot_index: int
    start_time: time
    end_time: time
    status: Literal["free", "reserved", "booked", "blocked"]
    exam_id: Optional[int] = None

    class Config:
        orm_mode = True


# --- Prüfungen -------------------------------------------------------------

class ExamBase(BaseModel):
    candidate_id: int
    exam_day_id: int
    exam_slot_id: int
    exam_type: str       # z.B. "aevo"
    status: str = "planned"

class ExamCreate(ExamBase):
    pass

class ExamOut(ExamBase):
    exam_id: int
    committee_id: int

    class Config:
        orm_mode = True

# -----------------------------
# Kandidaten (Candidates)
# -----------------------------
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

    class Config:
        from_attributes = True  # Pydantic v2


# End of app/domains/planner/schemas.py