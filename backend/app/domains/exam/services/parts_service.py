# app/domains/exam/services/parts_service.py

from decimal import Decimal
from typing import List, Dict

from sqlalchemy.orm import Session
from app.domains.exam.models import Exam, ExamPart


def get_default_parts_for_exam(exam: Exam) -> List[Dict]:
    """Hardcoded Definition der Prüfungsteile je exam_type."""
    if exam.exam_type == "aevo":
        return [
            {
                "part_number": 1,
                "title": "Teil 1: Präsentation / Durchführung",
                "weight": Decimal("50.0"),
            },
            {
                "part_number": 2,
                "title": "Teil 2: Fachgespräch",
                "weight": Decimal("50.0"),
            },
        ]
    # Weitere Typen später ergänzen
    return []


def ensure_exam_parts_for_exam(db: Session, exam: Exam) -> None:
    """Legt fehlende exam_parts für eine Prüfung an (z. B. AEVO Teil 1+2)."""
    existing_parts = {
        p.part_number: p for p in db.query(ExamPart).filter_by(exam_id=exam.exam_id)
    }
    defaults = get_default_parts_for_exam(exam)

    changed = False
    for spec in defaults:
        if spec["part_number"] not in existing_parts:
            part = ExamPart(
                exam_id=exam.exam_id,
                part_number=spec["part_number"],
                title=spec["title"],
                weight=spec["weight"],
                status="planned",
            )
            db.add(part)
            changed = True

    if changed:
        db.commit()

# End of file