# app/domains/exam/schemas.py
from __future__ import annotations

from datetime import date, datetime, time
from typing import Optional, Literal

from pydantic import BaseModel, Field, field_validator

StatusPT = Literal["geplant", "laufend", "pausiert", "abgeschlossen", "archiviert"]

# ---------- Paging ----------
class Page(BaseModel):
    items: list
    total: int
    page: int
    size: int

# ---------- Prüfungstag ----------
class PruefungstagBase(BaseModel):
    datum: date
    kammer_id: Optional[int] = None
    bezirkskammer_id: Optional[int] = None
    fachbereich_id: Optional[int] = None
    zeitschema_id: Optional[int] = None
    ort: str
    raum_default: Optional[str] = None
    status: Optional[str] = Field(default="geplant")
    bemerkung: Optional[str] = None
    aktiv: Optional[bool] = True

class PruefungstagCreate(PruefungstagBase):
    pass

class PruefungstagOut(PruefungstagBase):
    pruefungstag_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # SQLAlchemy -> Pydantic

class PruefungstagUpdate(BaseModel):
    datum: Optional[date] = None
    ort: Optional[str] = None
    kammer_id: Optional[int] = None
    bezirkskammer_id: Optional[int] = None
    fachbereich_id: Optional[int] = None
    raum_default: Optional[str] = None
    bemerkung: Optional[str] = None
    status: Optional[str] = None  # 'geplant' | 'laufend' | 'pausiert' | 'abgeschlossen' | 'archiviert'

    @field_validator("status")
    @classmethod
    def _status_ok(cls, v):
        if v is None:
            return v
        allowed = {"geplant", "laufend", "pausiert", "abgeschlossen", "archiviert"}
        if v not in allowed:
            raise ValueError("invalid status")
        return v

# ---------- Ausschuss-Zuordnung ----------
class AusschussAssignIn(BaseModel):
    ausschuss_id: int

class AusschussOut(BaseModel):
    ausschuss_id: int
    ausschuss_name: str
    fachbereich_id: Optional[int] = None
    bezirkskammer_id: Optional[int] = None

# ---------- Zeitschema ----------
class ZeitschemaCreate(BaseModel):
    name: str
    start: time
    ende: time
    slot_minuten: int = Field(gt=0)
    pause_minuten: int = Field(ge=0, default=0)

class ZeitschemaOut(ZeitschemaCreate):
    zeitschema_id: int

    class Config:
        from_attributes = True

# ---------- Slots ----------
class SlotGenerateIn(BaseModel):
    zeitschema_id: int
    maximal: int = Field(default=9, ge=1, le=9)
    ueberschreiben: bool = False

class SlotOut(BaseModel):
    pruefungsslot_id: int
    pruefungstag_ausschuss_id: int
    zeitschema_id: Optional[int] = None
    start_at: datetime
    end_at: datetime
    status: str
    raum: Optional[str] = None
    kandidat_id: Optional[int] = None

    class Config:
        from_attributes = True

# ---------- Kandidat-Assign ----------
class AssignIn(BaseModel):
    pruefkandidat_id: int

# ---------- Kandidat ----------
class KandidatOut(BaseModel):
    pruefkandidat_id: int
    vorname: str
    nachname: str

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
