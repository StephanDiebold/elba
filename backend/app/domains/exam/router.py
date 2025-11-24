# app/domains/exam/router.py
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import Optional
from datetime import date, datetime, timedelta, time as dtime

from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from app.core.deps import get_db
from app.domains.exam.models import (
    Pruefungstag, Ausschuss, PruefungstagAusschuss, Pruefungsslot, Zeitschema,
    Pruefkandidat, Pruefung, Kammer, Bezirkskammer, Fachbereich
)
from app.domains.exam.schemas import (
    PruefungstagOut,
    PruefungstagCreate,
    PruefungstagUpdate,
)

router = APIRouter(tags=["Planner"])

# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def _get_or_404(db: Session, model, pk: int, msg: str):
    obj = db.get(model, pk)
    if not obj:
        raise HTTPException(404, msg)
    return obj

def _inside_pause(t: dtime, pause_start: Optional[dtime], pause_ende: Optional[dtime]) -> bool:
    if not pause_start or not pause_ende:
        return False
    return pause_start <= t < pause_ende


# -------------------------------------------------------------------
# Prüfungstage
# -------------------------------------------------------------------

# --- LIST ---
@router.get("/pruefungstage", response_model=list[PruefungstagOut])
def list_pruefungstage(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    von: Optional[str] = None,
    bis: Optional[str] = None,
):
    q = db.query(Pruefungstag)
    if von:
        q = q.filter(Pruefungstag.datum >= von)
    if bis:
        q = q.filter(Pruefungstag.datum <= bis)
    q = q.order_by(Pruefungstag.datum.asc(), Pruefungstag.pruefungstag_id.asc())
    return q.offset((page - 1) * size).limit(size).all()

# --- CREATE ---
@router.post("/pruefungstage")
def create_pruefungstag(payload: PruefungstagCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    pt = Pruefungstag(**data)
    db.add(pt)
    db.commit()
    db.refresh(pt)
    return {"pruefungstag_id": pt.pruefungstag_id}

# --- DETAIL (GET) ---
@router.get("/pruefungstage/{pt_id}", response_model=PruefungstagOut)
def get_pruefungstag(pt_id: int, db: Session = Depends(get_db)):
    pt = db.get(Pruefungstag, pt_id)
    if not pt:
        raise HTTPException(status_code=404, detail="Prüfungstag nicht gefunden")
    return pt

# --- UPDATE (PUT/PATCH) ---
@router.put("/pruefungstage/{pt_id}")
@router.patch("/pruefungstage/{pt_id}")
def update_pruefungstag(pt_id: int, payload: PruefungstagUpdate, db: Session = Depends(get_db)):
    pt = db.get(Pruefungstag, pt_id)
    if not pt:
        raise HTTPException(status_code=404, detail="Prüfungstag nicht gefunden")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(pt, k, v)
    db.add(pt)
    db.commit()
    return {"ok": True, "pruefungstag_id": pt_id}

# --- DELETE ---
@router.delete("/pruefungstage/{pt_id}")
def delete_pruefungstag(pt_id: int, db: Session = Depends(get_db)):
    pt = db.get(Pruefungstag, pt_id)
    if not pt:
        raise HTTPException(status_code=404, detail="Prüfungstag nicht gefunden")
    db.delete(pt)
    db.commit()
    return {"ok": True}

# -------------------------------------------------------------------
# Ausschüsse ↔ Prüfungstag
# -------------------------------------------------------------------

@router.get("/pruefungstage/{pt_id}/ausschuesse")
def list_ausschuesse_for_day(pt_id: int, db: Session = Depends(get_db)):
    _get_or_404(db, Pruefungstag, pt_id, "Prüfungstag nicht gefunden")
    links = db.query(PruefungstagAusschuss).filter_by(pruefungstag_id=pt_id).all()
    result = []
    for link in links:
        a = db.get(Ausschuss, link.ausschuss_id)
        if a:
            result.append({
                "pta_id": link.pta_id,
                "ausschuss_id": a.ausschuss_id,
                "ausschuss_name": a.ausschuss_name,
                "max_pruefungen": link.max_pruefungen,
                "ort": link.ort,
                "raum": link.raum,
                "aktiv": link.aktiv,
            })
    return result


@router.post("/pruefungstage/{pt_id}/ausschuesse", status_code=201)
def assign_ausschuss(pt_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    _get_or_404(db, Pruefungstag, pt_id, "Prüfungstag nicht gefunden")
    ausschuss_id = payload.get("ausschuss_id")
    if not ausschuss_id:
        raise HTTPException(422, "ausschuss_id ist erforderlich")

    _get_or_404(db, Ausschuss, ausschuss_id, "Ausschuss nicht gefunden")

    dup = db.query(PruefungstagAusschuss).filter_by(
        pruefungstag_id=pt_id, ausschuss_id=ausschuss_id
    ).first()
    if dup:
        # vorhandenen Datensatz aktualisieren
        dup.ort = payload.get("ort", dup.ort)
        dup.raum = payload.get("raum", dup.raum)
        if "max_pruefungen" in payload:
            dup.max_pruefungen = payload["max_pruefungen"]
        if "aktiv" in payload:
            dup.aktiv = bool(payload["aktiv"])
        db.commit()
        db.refresh(dup)
        return {"ok": True, "info": "bereits zugeordnet", "pta_id": dup.pta_id}

    link = PruefungstagAusschuss(
        pruefungstag_id=pt_id,
        ausschuss_id=ausschuss_id,
        ort=payload.get("ort"),
        raum=payload.get("raum"),
        max_pruefungen=payload.get("max_pruefungen", 9),
        aktiv=payload.get("aktiv", True),
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return {"ok": True, "pta_id": link.pta_id}


# -------------------------------------------------------------------
# Ausschuss  (Stammdaten)
# -------------------------------------------------------------------

@router.get("/ausschuesse")
def list_all_ausschuesse(
    fachbereich_id: int | None = None,
    kammer_id: int | None = None,
    bezirkskammer_id: int | None = None,
    db: Session = Depends(get_db),
):
    # Basis-Query auf Ausschuss
    q = db.query(Ausschuss)

    # nach Fachbereich filtern (direkte Spalte)
    if fachbereich_id:
        q = q.filter(Ausschuss.fachbereich_id == fachbereich_id)

    # nach Bezirkskammer filtern (direkte Spalte)
    if bezirkskammer_id:
        q = q.filter(Ausschuss.bezirkskammer_id == bezirkskammer_id)

    # nach Kammer filtern (über Join auf Bezirkskammer)
    if kammer_id:
        q = (
            q.join(Bezirkskammer, Ausschuss.bezirkskammer_id == Bezirkskammer.bezirkskammer_id)
             .filter(Bezirkskammer.kammer_id == kammer_id)
        )

    rows = q.order_by(Ausschuss.ausschuss_name.asc()).all()

    # WICHTIG: nur Felder zurückgeben, die es wirklich gibt
    return [
        {
            "ausschuss_id": a.ausschuss_id,
            "ausschuss_name": a.ausschuss_name,
            "fachbereich_id": a.fachbereich_id,
            "bezirkskammer_id": a.bezirkskammer_id,
        }
        for a in rows
    ]



# -------------------------------------------------------------------
# Zeitschemata
# -------------------------------------------------------------------

@router.get("/zeitschemata")
def list_zeitschemata(db: Session = Depends(get_db)):
    zs = db.query(Zeitschema).order_by(Zeitschema.name.asc()).all()
    return [{
        "zeitschema_id": z.zeitschema_id,
        "name": z.name,
        "tag_start": z.tag_start,
        "slot_dauer_minuten": z.slot_dauer_minuten,
        "puffer_minuten": z.puffer_minuten,
        "pause_start": z.pause_start,
        "pause_ende": z.pause_ende,
        "max_kandidaten_pro_slot": z.max_kandidaten_pro_slot,
        "aktiv": z.aktiv
    } for z in zs]


@router.post("/zeitschemata", status_code=201)
def create_zeitschema(payload: dict = Body(...), db: Session = Depends(get_db)):
    required = {"name", "tag_start", "slot_dauer_minuten", "puffer_minuten"}
    if any(k not in payload for k in required):
        raise HTTPException(422, f"erforderlich: {', '.join(sorted(required))}")

    z = Zeitschema(
        name=payload["name"],
        tag_start=payload["tag_start"],
        slot_dauer_minuten=payload["slot_dauer_minuten"],
        puffer_minuten=payload["puffer_minuten"],
        pause_start=payload.get("pause_start"),
        pause_ende=payload.get("pause_ende"),
        max_kandidaten_pro_slot=payload.get("max_kandidaten_pro_slot", 1),
        aktiv=payload.get("aktiv", True),
    )
    db.add(z); db.commit(); db.refresh(z)
    return {"zeitschema_id": z.zeitschema_id, "name": z.name}


# -------------------------------------------------------------------
# Slots
# -------------------------------------------------------------------

@router.get("/pruefungstag_ausschuss/{pta_id}/slots")
def list_slots(
    pta_id: int,
    status: Optional[str] = Query(None, description="frei|geplant|gesperrt|abgesagt"),
    db: Session = Depends(get_db),
):
    _get_or_404(db, PruefungstagAusschuss, pta_id, "Zuordnung Tag↔Ausschuss nicht gefunden")
    q = db.query(Pruefungsslot).filter(Pruefungsslot.pta_id == pta_id)
    if status:
        q = q.filter(Pruefungsslot.status == status)
    slots = q.order_by(Pruefungsslot.start_at.asc()).all()
    return [{
        "slot_id": s.slot_id,
        "pruefungstag_id": s.pruefungstag_id,
        "pta_id": s.pta_id,
        "start_at": s.start_at,
        "end_at": s.end_at,
        "status": s.status,
        "capacity": s.capacity,
        "aktiv": s.aktiv
    } for s in slots]


@router.post("/pruefungstag_ausschuss/{pta_id}/slots/generate")
def generate_slots(
    pta_id: int,
    body: dict = Body(..., example={"zeitschema_id": 1, "anzahl": 9, "ueberschreiben": False}),
    db: Session = Depends(get_db),
):
    link = _get_or_404(db, PruefungstagAusschuss, pta_id, "Zuordnung Tag↔Ausschuss nicht gefunden")
    pt = _get_or_404(db, Pruefungstag, link.pruefungstag_id, "Prüfungstag nicht gefunden")

    zeitschema_id = body.get("zeitschema_id") or pt.zeitschema_id
    if not zeitschema_id:
        raise HTTPException(422, "zeitschema_id ist erforderlich (im Body oder am Prüfungstag)")
    zs = _get_or_404(db, Zeitschema, zeitschema_id, "Zeitschema nicht gefunden")

    # existierende freie Slots optional löschen
    if body.get("ueberschreiben"):
        (db.query(Pruefungsslot)
           .filter(Pruefungsslot.pta_id == pta_id, Pruefungsslot.status == "frei")
           .delete(synchronize_session=False))

    # bereits vorhandene Slots (alle Status) mitzählen → Obergrenze
    existing = db.query(Pruefungsslot).filter(Pruefungsslot.pta_id == pta_id).count()
    max_allowed = min(link.max_pruefungen or 9, 9)
    requested = int(body.get("anzahl", max_allowed))
    to_create = max(0, min(requested, max_allowed - existing))
    if to_create <= 0:
        db.commit()
        return {"ok": True, "anzahl": 0, "hinweis": "Obergrenze erreicht"}

    # Startzeitpunkt berechnen: pt.datum + zeitschema.tag_start
    t = datetime.combine(pt.datum, zs.tag_start)

    # wenn freie Slots vorhanden sind → letzten Endzeitpunkt als Start nehmen
    last_slot = (db.query(Pruefungsslot)
                   .filter(Pruefungsslot.pta_id == pta_id)
                   .order_by(Pruefungsslot.start_at.desc())
                   .first())
    if last_slot:
        # Anschluss nach letztem Slot + puffer
        t = last_slot.end_at + timedelta(minutes=zs.puffer_minuten)

    created = 0
    for _ in range(to_create):
        # Pause berücksichtigen
        if _inside_pause(t.time(), zs.pause_start, zs.pause_ende):
            # springe auf Ende der Pause
            t = datetime.combine(pt.datum, zs.pause_ende)

        start_at = t
        end_at = start_at + timedelta(minutes=zs.slot_dauer_minuten)

        s = Pruefungsslot(
            pruefungstag_id=pt.pruefungstag_id,
            pta_id=pta_id,
            start_at=start_at,
            end_at=end_at,
            status="frei",
            capacity=zs.max_kandidaten_pro_slot or 1,
            aktiv=True,
        )
        db.add(s)
        created += 1

        # nächster Slot
        t = end_at + timedelta(minutes=zs.puffer_minuten)

    db.commit()
    return {"ok": True, "anzahl": created}


@router.patch("/slots/{slot_id}/status")
def change_slot_status(slot_id: int, body: dict = Body(...), db: Session = Depends(get_db)):
    s = _get_or_404(db, Pruefungsslot, slot_id, "Slot nicht gefunden")
    new_status = body.get("status")
    if new_status not in {"frei", "geplant", "gesperrt", "abgesagt"}:
        raise HTTPException(422, "status muss einer von frei|geplant|gesperrt|abgesagt sein")
    s.status = new_status
    db.commit()
    return {"ok": True, "slot_id": s.slot_id, "status": s.status}


# -------------------------------------------------------------------
# Kandidat ↔ Slot (Prüfung)
# -------------------------------------------------------------------

@router.post("/slots/{slot_id}/assign")
def assign_candidate(slot_id: int, body: dict = Body(...), db: Session = Depends(get_db)):
    slot = _get_or_404(db, Pruefungsslot, slot_id, "Slot nicht gefunden")
    kandidat_id = body.get("pruefkandidat_id")
    if not kandidat_id:
        raise HTTPException(422, "pruefkandidat_id ist erforderlich")

    _get_or_404(db, Pruefkandidat, kandidat_id, "Prüfkandidat nicht gefunden")

    if slot.status not in {"frei", "geplant"}:
        raise HTTPException(409, f"Slot-Status {slot.status} erlaubt keine Zuordnung")

    # Prüfen: Kandidat bereits am gleichen Prüfungstag eingeplant?
    conflict = (
        db.query(Pruefung)
          .filter(Pruefung.pruefkandidat_id == kandidat_id,
                  Pruefung.pruefungstag_id == slot.pruefungstag_id)
          .first()
    )
    if conflict:
        raise HTTPException(409, "Kandidat ist am selben Prüfungstag bereits eingeplant")

    # Prüfen: Slot schon belegt (pruefung.slot_id UNIQUE)
    existing_for_slot = db.query(Pruefung).filter_by(slot_id=slot.slot_id).first()
    if existing_for_slot:
        raise HTTPException(409, "Slot ist bereits zugeordnet")

    p = Pruefung(
        pruefungstag_id=slot.pruefungstag_id,
        slot_id=slot.slot_id,
        pruefkandidat_id=kandidat_id,
        status="geplant",
    )
    slot.status = "geplant"
    db.add(p); db.commit(); db.refresh(p)
    return {"ok": True, "pruefung_id": p.pruefung_id}


@router.post("/slots/{slot_id}/unassign")
def unassign_candidate(slot_id: int, db: Session = Depends(get_db)):
    slot = _get_or_404(db, Pruefungsslot, slot_id, "Slot nicht gefunden")

    p = db.query(Pruefung).filter_by(slot_id=slot.slot_id).first()
    if not p:
        # Slot ggf. freigeben
        if slot.status != "frei":
            slot.status = "frei"
            db.commit()
        return {"ok": True, "info": "keine Prüfung zu diesem Slot"}

    db.delete(p)
    slot.status = "frei"
    db.commit()
    return {"ok": True}
