# backend/app/domains/admin/schemas.py
from __future__ import annotations

from datetime import datetime, time as dtime
from typing import Optional, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

OrgUnitType = Literal["chamber", "district_chamber"]


# ===================================================================
# Org Units
# ===================================================================

class OrgUnitBase(BaseModel):
    type: OrgUnitType
    name: str
    code: Optional[str] = None
    is_active: bool = True
    parent_org_unit_id: Optional[int] = None


class OrgUnitCreate(OrgUnitBase):
    pass


class OrgUnitUpdate(BaseModel):
    type: Optional[OrgUnitType] = None
    name: Optional[str] = None
    code: Optional[str] = None
    is_active: Optional[bool] = None
    parent_org_unit_id: Optional[int] = None


class OrgUnitOut(OrgUnitBase):
    org_unit_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===================================================================
# Committees
# ===================================================================

class CommitteeBase(BaseModel):
    org_unit_id: int
    name: str
    description: Optional[str] = None
    is_active: bool = True


class CommitteeCreate(CommitteeBase):
    pass


class CommitteeUpdate(BaseModel):
    org_unit_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CommitteeOut(CommitteeBase):
    committee_id: int
    model_config = ConfigDict(from_attributes=True)


# ===================================================================
# Committee Function
# ===================================================================

class CommitteeFunctionBase(BaseModel):
    code: str
    display_name_de: str


class CommitteeFunctionCreate(CommitteeFunctionBase):
    pass


class CommitteeFunctionUpdate(BaseModel):
    code: Optional[str] = None
    display_name_de: Optional[str] = None


class CommitteeFunctionOut(CommitteeFunctionBase):
    committee_function_id: int
    model_config = ConfigDict(from_attributes=True)


# ===================================================================
# Committee Position
# ===================================================================

class CommitteePositionBase(BaseModel):
    code: str
    display_name_de: str


class CommitteePositionCreate(CommitteePositionBase):
    pass


class CommitteePositionUpdate(BaseModel):
    code: Optional[str] = None
    display_name_de: Optional[str] = None


class CommitteePositionOut(CommitteePositionBase):
    committee_position_id: int
    model_config = ConfigDict(from_attributes=True)


# ===================================================================
# User Committee
# ===================================================================

class UserCommitteeBase(BaseModel):
    user_id: int
    committee_id: int
    committee_function_id: Optional[int] = None
    committee_position_id: Optional[int] = None
    is_active: bool = True


class UserCommitteeCreate(UserCommitteeBase):
    pass


class UserCommitteeUpdate(BaseModel):
    user_id: Optional[int] = None
    committee_id: Optional[int] = None
    committee_function_id: Optional[int] = None
    committee_position_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserCommitteeOut(UserCommitteeBase):
    user_committee_id: int
    model_config = ConfigDict(from_attributes=True)


class CommitteeMemberOut(BaseModel):
    user_committee_id: int
    user_id: int
    committee_id: int
    committee_function_id: Optional[int] = None
    committee_function_name: Optional[str] = None
    committee_position_id: Optional[int] = None
    committee_position_name: Optional[str] = None
    display_name: str
    email: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class UserCommitteeAssignmentOut(BaseModel):
    user_committee_id: int
    user_id: int
    committee_id: int
    committee_name: str
    org_unit_id: int
    org_unit_name: str
    committee_function_id: Optional[int] = None
    committee_function_name: Optional[str] = None
    committee_position_id: Optional[int] = None
    committee_position_name: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# ===================================================================
# Time Schemes (Administration)
# ===================================================================

def _normalize_time_str(v: str) -> str:
    """
    akzeptiert 'HH:MM' oder 'HH:MM:SS' und normalisiert auf 'HH:MM:SS'
    """
    v = (v or "").strip()
    parts = v.split(":")
    if len(parts) not in (2, 3):
        raise ValueError("default_first_slot_start must be 'HH:MM' or 'HH:MM:SS'")
    hh, mm = parts[0], parts[1]
    ss = parts[2] if len(parts) == 3 else "00"
    if not (hh.isdigit() and mm.isdigit() and ss.isdigit()):
        raise ValueError("default_first_slot_start must contain only digits and ':'")
    h, m, s = int(hh), int(mm), int(ss)
    if not (0 <= h <= 23 and 0 <= m <= 59 and 0 <= s <= 59):
        raise ValueError("default_first_slot_start is out of range")
    return f"{h:02d}:{m:02d}:{s:02d}"


def _time_from_str(v: str) -> dtime:
    parts = _normalize_time_str(v).split(":")
    return dtime(hour=int(parts[0]), minute=int(parts[1]), second=int(parts[2]))


class TimeSchemeBase(BaseModel):
    name: str

    # ✅ OUT/ORM: echter time-Typ (FastAPI gibt JSON als "HH:MM:SS" aus)
    default_first_slot_start: dtime = Field(..., examples=["08:10:00"])

    exam_duration_minutes: int
    discussion_buffer_minutes: int
    max_slots: int

    lunch_after_slots: Optional[int] = None
    lunch_break_duration_minutes: Optional[int] = None

    is_active: bool = True

    # ✅ akzeptiert sowohl ORM-time als auch string (z.B. wenn du später direkt vom Client setzt)
    @field_validator("default_first_slot_start", mode="before")
    @classmethod
    def parse_default_first_slot_start(cls, v):
        if isinstance(v, dtime):
            return v
        if isinstance(v, str):
            return _time_from_str(v)
        raise ValueError("default_first_slot_start must be time or 'HH:MM'/'HH:MM:SS'")


class TimeSchemeCreate(BaseModel):
    # ✅ Input darf string bleiben (du parsest im Router)
    name: str
    default_first_slot_start: str = Field(..., examples=["08:10", "08:10:00"])
    exam_duration_minutes: int
    discussion_buffer_minutes: int
    max_slots: int
    lunch_after_slots: Optional[int] = None
    lunch_break_duration_minutes: Optional[int] = None
    is_active: bool = True

    @field_validator("default_first_slot_start")
    @classmethod
    def validate_time_str(cls, v: str) -> str:
        return _normalize_time_str(v)


class TimeSchemeUpdate(BaseModel):
    name: Optional[str] = None
    default_first_slot_start: Optional[str] = None
    exam_duration_minutes: Optional[int] = None
    discussion_buffer_minutes: Optional[int] = None
    max_slots: Optional[int] = None
    lunch_after_slots: Optional[int] = None
    lunch_break_duration_minutes: Optional[int] = None
    is_active: Optional[bool] = None

    @field_validator("default_first_slot_start")
    @classmethod
    def validate_time_str_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return _normalize_time_str(v)


class TimeSchemeOut(TimeSchemeBase):
    time_scheme_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===================================================================
# Default TimeScheme per OrgUnit + Subject
# ===================================================================

class TimeSchemeDefaultBase(BaseModel):
    org_unit_id: int
    subject_id: int
    time_scheme_id: int
    is_active: bool = True


class TimeSchemeDefaultCreate(TimeSchemeDefaultBase):
    pass


class TimeSchemeDefaultUpdate(BaseModel):
    org_unit_id: Optional[int] = None
    subject_id: Optional[int] = None
    time_scheme_id: Optional[int] = None
    is_active: Optional[bool] = None


class TimeSchemeDefaultOut(TimeSchemeDefaultBase):
    time_scheme_default_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ResolvedTimeSchemeOut(BaseModel):
    org_unit_id: int
    subject_id: int
    resolved_time_scheme_id: Optional[int] = None
    resolved_from_org_unit_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
