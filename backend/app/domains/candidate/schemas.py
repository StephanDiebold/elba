# app/domains/candidate/schemas.py

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CandidateBase(BaseModel):
    # 🔽 optional + Default = None
    candidate_number: Optional[str] = None

    first_name: str
    last_name: str

    email: Optional[str] = None
    mobile_number: Optional[str] = None

    street: Optional[str] = None
    street_number: Optional[str] = None
    postcode: Optional[str] = None
    city: Optional[str] = None

    education_provider: Optional[str] = None

    employer: Optional[str] = None
    employer_street: Optional[str] = None
    employer_street_no: Optional[str] = None
    employer_postcode: Optional[str] = None
    employer_city: Optional[str] = None

    postal_box: Optional[str] = None


class CandidateCreate(CandidateBase):
    pass


class CandidateUpdate(BaseModel):
    # alles optional für PATCH
    candidate_number: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    street: Optional[str] = None
    street_number: Optional[str] = None
    postcode: Optional[str] = None
    city: Optional[str] = None
    education_provider: Optional[str] = None
    employer: Optional[str] = None
    employer_street: Optional[str] = None
    employer_street_no: Optional[str] = None
    employer_postcode: Optional[str] = None
    employer_city: Optional[str] = None
    postal_box: Optional[str] = None


class CandidateOut(CandidateBase):
    candidate_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
# end of app/domains/candidate/schemas.py