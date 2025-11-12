# app/domains/exam/schemas.py
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import date, datetime

class PruefungstagOut(BaseModel):
    pruefungstag_id: int
    datum: date
    ort: str
    raum: Optional[str] = None
    ausschuss_id: int
    status: Literal['geplant','laufend','pausiert','abgeschlossen','archiviert']
    class Config:
        orm_mode = True   # pydantic v1/v2-sicher

class SlotOut(BaseModel):
    pruefung_id: int
    pruefkandidat_id: int
    kandidat_name: str
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    teil1_art: Literal['praesentation','durchfuehrung']
    status: Literal['geplant','aufgerufen','teil1','teil2','bewertung','final']
    theorie_punkte: Optional[float] = None
    theorie_note: Optional[float] = None
    class Config:
        orm_mode = True

class PruefungDetailOut(SlotOut):
    pruefungstag_id: int
