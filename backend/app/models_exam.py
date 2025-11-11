# app/models_exam.py
from sqlalchemy import Column, Integer, String, Date, DateTime, Enum, Text, ForeignKey, DECIMAL, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class Ausschuss(Base):
    __tablename__ = "ausschuss"
    ausschuss_id = Column(Integer, primary_key=True, autoincrement=True)
    ausschuss_name = Column(String(200), nullable=False, unique=True)

class Pruefkandidat(Base):
    __tablename__ = "pruefkandidat"
    pruefkandidat_id = Column(Integer, primary_key=True, autoincrement=True)
    vorname = Column(String(100), nullable=False)
    nachname = Column(String(100), nullable=False)

class Pruefungstag(Base):
    __tablename__ = "pruefungstag"
    pruefungstag_id = Column(Integer, primary_key=True, autoincrement=True)
    ausschuss_id = Column(Integer, ForeignKey("ausschuss.ausschuss_id"), nullable=False)
    datum = Column(Date, nullable=False)
    ort = Column(String(200), nullable=False)
    raum = Column(String(100))
    status = Column(Enum('geplant','laufend','pausiert','abgeschlossen','archiviert'), nullable=False, default='geplant')

class Pruefung(Base):
    __tablename__ = "pruefung"
    pruefung_id = Column(Integer, primary_key=True, autoincrement=True)
    pruefungstag_id = Column(Integer, ForeignKey("pruefungstag.pruefungstag_id"), nullable=False)
    pruefkandidat_id = Column(Integer, ForeignKey("pruefkandidat.pruefkandidat_id"), nullable=False)
    start_at = Column(DateTime)
    end_at = Column(DateTime)
    teil1_art = Column(Enum('praesentation','durchfuehrung'), nullable=False, default='praesentation')
    theorie_punkte = Column(DECIMAL(5,2))
    theorie_note = Column(DECIMAL(4,2))
    status = Column(Enum('geplant','aufgerufen','teil1','teil2','bewertung','final'), nullable=False, default='geplant')
