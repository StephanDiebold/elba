# app/schemas_exam.py
from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, Literal

class PruefungstagOut(BaseModel):
    pruefungstag_id: int
    datum: date
    ort: str
    raum: Optional[str] = None
    ausschuss_id: int
    status: Literal['geplant','laufend','pausiert','abgeschlossen','archiviert']
    class Config:
        from_attributes = True

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

class PruefungDetailOut(SlotOut):
    pruefungstag_id: int
