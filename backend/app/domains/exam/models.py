# app/domains/exam/models.py
from sqlalchemy import (
    Column, Integer, String, Date, DateTime, Enum, Text, ForeignKey, DECIMAL, Time, Boolean,
    UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from app.core.database import Base

# -------------------------------
# 👤 Prüfkandidat
# -------------------------------
class Pruefkandidat(Base):
    __tablename__ = "pruefkandidat"

    pruefkandidat_id = Column(Integer, primary_key=True, autoincrement=True)
    vorname = Column(String(100), nullable=False)
    nachname = Column(String(100), nullable=False)

    geburtsdatum = Column(Date, nullable=True)
    email = Column(String(200), nullable=True)
    telefon = Column(String(50), nullable=True)
    strasse = Column(String(200), nullable=True)
    plz = Column(String(10), nullable=True)
    ort = Column(String(100), nullable=True)
    ausbildungsbetrieb = Column(String(200), nullable=True)
    ihk_pruefungsnr = Column(String(50), nullable=True, unique=True)
    pruefungsberuf = Column(String(200), nullable=True)

    status = Column(
        Enum("angemeldet", "zugelassen", "anwesend", "abgemeldet", "nicht_erschienen", name="pruefkandidat_status"),
        nullable=False,
        server_default="angemeldet",
    )
    bemerkung = Column(Text, nullable=True)
    aktiv = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    pruefungen = relationship("Pruefung", back_populates="pruefkandidat")


# -------------------------------
# 🏢 Kammer / Bezirkskammer / Fachbereich
# (Kammer/Bezirkskammer haben laut DB keine Timestamps)
# -------------------------------
class Kammer(Base):
    __tablename__ = "kammer"
    kammer_id = Column(Integer, primary_key=True, autoincrement=True)
    kammer_name = Column(String(160), nullable=False)
    kammer_kuerzel = Column(String(20), nullable=False, unique=True)
    beschreibung = Column(Text, nullable=True)

class Bezirkskammer(Base):
    __tablename__ = "bezirkskammer"
    bezirkskammer_id = Column(Integer, primary_key=True, autoincrement=True)
    kammer_id = Column(Integer, ForeignKey("kammer.kammer_id"), nullable=False, index=True)
    bezirkskammer_name = Column(String(160), nullable=False)
    bezirkskammer_kuerzel = Column(String(20), nullable=False)
    beschreibung = Column(Text, nullable=True)

class Fachbereich(Base):
    __tablename__ = "fachbereich"
    fachbereich_id = Column(Integer, primary_key=True, autoincrement=True)
    fachbereich_name = Column(String(200), nullable=False, unique=True)
    kuerzel = Column(String(20), nullable=True)
    beschreibung = Column(Text, nullable=True)
    aktiv = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


# -------------------------------
# 👥 Ausschuss
# -------------------------------
class Ausschuss(Base):
    __tablename__ = "ausschuss"

    ausschuss_id = Column(Integer, primary_key=True, autoincrement=True)
    ausschuss_name = Column(String(200), nullable=False, unique=True)
    fachbereich_id = Column(Integer, ForeignKey("fachbereich.fachbereich_id"), nullable=True, index=True)
    ihk_id = Column(Integer, nullable=True)
    bezirkskammer_id = Column(Integer, ForeignKey("bezirkskammer.bezirkskammer_id"), nullable=True)
    beschreibung = Column(Text, nullable=True)
    aktiv = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    fachbereich = relationship("Fachbereich")
    bezirkskammer = relationship("Bezirkskammer")
    tage = relationship("PruefungstagAusschuss", back_populates="ausschuss")


# -------------------------------
# ⏱ Zeitschema
# -------------------------------
class Zeitschema(Base):
    __tablename__ = "zeitschema"

    zeitschema_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False, unique=True)
    tag_start = Column(Time, nullable=False)
    slot_dauer_minuten = Column(Integer, nullable=False)
    puffer_minuten = Column(Integer, nullable=False)
    pause_start = Column(Time, nullable=True)
    pause_ende = Column(Time, nullable=True)
    max_kandidaten_pro_slot = Column(Integer, nullable=False, server_default="1")
    aktiv = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


# -------------------------------
# 📅 Prüfungstag
# -------------------------------
class Pruefungstag(Base):
    __tablename__ = "pruefungstag"

    pruefungstag_id = Column(Integer, primary_key=True, autoincrement=True)

    kammer_id = Column(Integer, ForeignKey("kammer.kammer_id"), nullable=True, index=True)
    bezirkskammer_id = Column(Integer, ForeignKey("bezirkskammer.bezirkskammer_id"), nullable=True, index=True)
    fachbereich_id = Column(Integer, ForeignKey("fachbereich.fachbereich_id"), nullable=True, index=True)
    zeitschema_id = Column(Integer, ForeignKey("zeitschema.zeitschema_id"), nullable=True, index=True)
    pruefungskoordinator_id = Column(Integer, ForeignKey("user.user_id"), nullable=True, index=True)

    datum = Column(Date, nullable=False, index=True)
    ort = Column(String(200), nullable=False)
    raum_default = Column(String(100), nullable=True)

    status = Column(
        Enum("geplant", "laufend", "pausiert", "abgeschlossen", "archiviert", name="pruefungstag_status"),
        nullable=False,
        server_default="geplant",
    )
    bemerkung = Column(Text, nullable=True)
    aktiv = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    kammer = relationship("Kammer")
    bezirkskammer = relationship("Bezirkskammer")
    fachbereich = relationship("Fachbereich")
    zeitschema = relationship("Zeitschema")

    ausschuesse = relationship("PruefungstagAusschuss", back_populates="pruefungstag")
    pruefungen = relationship("Pruefung", back_populates="pruefungstag")


# -------------------------------
# 🧑‍⚖️ Prüfungstag ↔ Ausschuss
# -------------------------------
class PruefungstagAusschuss(Base):
    __tablename__ = "pruefungstag_ausschuss"

    pta_id = Column(Integer, primary_key=True, autoincrement=True)
    pruefungstag_id = Column(Integer, ForeignKey("pruefungstag.pruefungstag_id"), nullable=False, index=True)
    ausschuss_id = Column(Integer, ForeignKey("ausschuss.ausschuss_id"), nullable=False, index=True)

    raum = Column(String(100), nullable=True)
    ort = Column(String(200), nullable=True)
    pruefungskoordinator_id = Column(Integer, ForeignKey("user.user_id"), nullable=True)
    max_pruefungen = Column(Integer, nullable=False, server_default="9")
    bemerkung = Column(Text, nullable=True)
    aktiv = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    __table_args__ = (
        UniqueConstraint("pruefungstag_id", "ausschuss_id", name="uq_pta_pruefungstag_ausschuss"),
    )

    pruefungstag = relationship("Pruefungstag", back_populates="ausschuesse")
    ausschuss = relationship("Ausschuss", back_populates="tage")
    slots = relationship("Pruefungsslot", back_populates="pta")


# -------------------------------
# 🧭 Slots
# -------------------------------
class Pruefungsslot(Base):
    __tablename__ = "pruefungsslot"

    slot_id = Column(Integer, primary_key=True, autoincrement=True)
    pruefungstag_id = Column(Integer, ForeignKey("pruefungstag.pruefungstag_id"), nullable=False, index=True)
    pta_id = Column(Integer, ForeignKey("pruefungstag_ausschuss.pta_id"), nullable=False, index=True)

    start_at = Column(DateTime, nullable=False)
    end_at = Column(DateTime, nullable=False)
    status = Column(
        Enum("frei", "geplant", "gesperrt", "abgesagt", name="slot_status"),
        nullable=False,
        server_default="frei",
    )
    capacity = Column(Integer, nullable=False, server_default="1")
    aktiv = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    pruefungstag = relationship("Pruefungstag")
    pta = relationship("PruefungstagAusschuss", back_populates="slots")
    pruefung = relationship("Pruefung", back_populates="slot", uselist=False)


# -------------------------------
# ✅ Prüfung
# -------------------------------
class Pruefung(Base):
    __tablename__ = "pruefung"

    pruefung_id = Column(Integer, primary_key=True, autoincrement=True)

    pruefungstag_id = Column(Integer, ForeignKey("pruefungstag.pruefungstag_id"), nullable=False, index=True)
    slot_id = Column(Integer, ForeignKey("pruefungsslot.slot_id"), nullable=True, unique=True)
    pruefkandidat_id = Column(Integer, ForeignKey("pruefkandidat.pruefkandidat_id"), nullable=False, index=True)
    fachbereich_id = Column(Integer, ForeignKey("fachbereich.fachbereich_id"), nullable=True, index=True)

    start_at = Column(DateTime, nullable=True)
    end_at = Column(DateTime, nullable=True)
    teil1_art = Column(Enum("praesentation", "durchfuehrung", name="teil1_art"), nullable=False, server_default="praesentation")
    theorie_punkte = Column(DECIMAL(5, 2), nullable=True)
    theorie_note = Column(DECIMAL(4, 2), nullable=True)

    status = Column(
        Enum("geplant", "aufgerufen", "teil1", "teil2", "bewertung", "final", name="pruefung_status"),
        nullable=False,
        server_default="geplant",
    )
    bemerkung = Column(Text, nullable=True)
    aktiv = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    pruefungstag = relationship("Pruefungstag", back_populates="pruefungen")
    slot = relationship("Pruefungsslot", back_populates="pruefung")
    pruefkandidat = relationship("Pruefkandidat", back_populates="pruefungen")
    fachbereich = relationship("Fachbereich")
