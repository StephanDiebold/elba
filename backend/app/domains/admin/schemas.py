from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, ConfigDict

OrgUnitType = Literal["chamber", "district_chamber"]


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
    type: Literal['chamber', 'district_chamber']
    name: str
    code: Optional[str] = None
    is_active: bool
    parent_org_unit_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CommitteeBase(BaseModel):
    org_unit_id: int
    name: str
    description: Optional[str] = None
    is_active: Optional[bool] = True


class CommitteeCreate(CommitteeBase):
    pass


class CommitteeUpdate(BaseModel):
    org_unit_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CommitteeOut(CommitteeBase):
    committee_id: int

    class Config:
        from_attributes = True


# ---------- Committee Function ----------

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

    class Config:
        from_attributes = True


# ---------- Committee Position ----------

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

    class Config:
        from_attributes = True


# ---------- User Committee ----------

class UserCommitteeBase(BaseModel):
    user_id: int
    committee_id: int
    committee_function_id: Optional[int] = None
    committee_position_id: Optional[int] = None
    is_active: Optional[bool] = True


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

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True


# ---------- End of Schemas ----------