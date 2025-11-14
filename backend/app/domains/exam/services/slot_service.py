# app/domains/exam/services/slot_service.py

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.exc import NoResultFound

from app.domains.exam.models import (
    PruefungstagAusschuss,
    Pruefungsslot,
    Zeitschema,
)


def generate_slots_from_schema(pta_id: int, db: Session) -> int:
    """
    Erzeugt Slots für einen Prüfungstag-Ausschuss basierend auf dem verknüpften Zeitschema.
    Vorhandene freie Slots werden vorher gelöscht.
    """
    try:
        # Lade PTA (inkl. zugehörigem Tag)
        pta = (
            db.query(PruefungstagAusschuss)
            .filter_by(pta_id=pta_id)
            .join(PruefungstagAusschuss.pruefungstag)
            .one()
        )
    except NoResultFound:
        raise ValueError(f"PruefungstagAusschuss mit ID {pta_id} nicht gefunden.")

    tag = pta.pruefungstag
    schema = db.query(Zeitschema).filter_by(zeitschema_id=tag.zeitschema_id).first()
    if not schema:
        raise ValueError(f"Kein Zeitschema für pruefungstag_id={tag.pruefungstag_id} gefunden.")

    # --- Eckdaten berechnen ---
    tag_datum = tag.datum
    current_time = datetime.combine(tag_datum, schema.tag_start)

    slot_dauer = timedelta(
        minutes=schema.slot_dauer_minuten + schema.puffer_minuten
    )

    pause_start = (
        datetime.combine(tag_datum, schema.pause_start)
        if schema.pause_start else None
    )
    pause_end = (
        datetime.combine(tag_datum, schema.pause_end)
        if schema.pause_end else None
    )

    max_slots = pta.max_pruefungen

    # --- Vorhandene freie Slots löschen ---
    db.query(Pruefungsslot).filter_by(pta_id=pta_id, status="frei").delete()

    count = 0
    for _ in range(max_slots):
        slot_start = current_time
        slot_end = slot_start + slot_dauer

        # Skip Slot, wenn er mit Pause kollidiert
        if (
            pause_start and pause_end
            and slot_start < pause_end
            and slot_end > pause_start
        ):
            current_time = pause_end
            continue

        # Neuen Slot anlegen
        db.add(Pruefungsslot(
            pruefungstag_id=tag.pruefungstag_id,
            pta_id=pta_id,
            start_at=slot_start,
            end_at=slot_end,
            capacity=1,
            status="frei",
        ))

        count += 1
        current_time = slot_end

    db.commit()
    return count
