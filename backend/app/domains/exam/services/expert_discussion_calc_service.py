# backend/app/domains/exam/services/expert_discussion_calc_service.py

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Tuple, List

from sqlalchemy.orm import Session

# Passe die Imports an deine tatsächlichen Modelpfade an:
from app.domains.exam.models import ExamPart, ExamExpertDiscussionArea
from app.domains.exam.models import GradeKeyVersion, GradeKeyEntry  # <-- falls bei dir anders heißt, anpassen


def _clamp_int(x: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, x))


def _round2(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _find_active_grade_key_version_id(db: Session, subject_id: int) -> Optional[int]:
    """
    Holt die aktive GradeKey-Version für ein Subject.
    Anpassung je nach deinem Datenmodell:
    - wenn GradeKeyVersion ein Flag is_active hat -> perfekt
    - sonst: "neueste" Version nehmen
    """
    row = (
        db.query(GradeKeyVersion)
        .filter(GradeKeyVersion.subject_id == subject_id)
        .order_by(getattr(GradeKeyVersion, "is_active", GradeKeyVersion.grade_key_version_id).desc(),
                  GradeKeyVersion.grade_key_version_id.desc())
        .first()
    )
    return row.grade_key_version_id if row else None


def _load_grade_key_entries(db: Session, grade_key_version_id: int) -> List[GradeKeyEntry]:
    return (
        db.query(GradeKeyEntry)
        .filter(GradeKeyEntry.grade_key_version_id == grade_key_version_id)
        .all()
    )


def _points_to_grade(entries: List[GradeKeyEntry], points_100: Decimal) -> Optional[Decimal]:
    """
    Punkte (0..100) -> Note (grade_decimal) über grade_key_entry.
    grade_key_entry.points_100 ist i.d.R. int 0..100.
    Wir mappen auf den nächsten vorhandenen Integer-Punktwert.
    """
    if not entries:
        return None

    p_int = _clamp_int(int(points_100.quantize(Decimal("1"), rounding=ROUND_HALF_UP)), 0, 100)

    exact = next((e for e in entries if int(e.points_100) == p_int), None)
    if exact:
        return Decimal(str(exact.grade_decimal))

    # falls Lücke (sollte selten sein): nächsten finden
    nearest = min(entries, key=lambda e: abs(int(e.points_100) - p_int))
    return Decimal(str(nearest.grade_decimal))


def _grade_to_points(entries: List[GradeKeyEntry], grade_decimal: Decimal) -> Optional[Decimal]:
    """
    Note -> Punkte über grade_key_entry (inverse Richtung).
    grade_key_entry hat eigentlich points -> grade, daher:
    - wir nehmen alle rows mit exakt dieser grade_decimal
    - und nehmen als repräsentativen Punktwert den Mittelwert aus min/max
      (robust gegen Bereiche)
    """
    if not entries:
        return None

    g = Decimal(str(grade_decimal))

    rows = [e for e in entries if Decimal(str(e.grade_decimal)) == g]
    if not rows:
        return None

    pts = sorted(int(e.points_100) for e in rows)
    mid = Decimal(str((pts[0] + pts[-1]) / 2))
    return _round2(mid)


def calculate_and_persist_expert_discussion_result(
    db: Session,
    exam_part_id: int,
    subject_id: int,
) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    """
    Berechnet:
      - exam_part.expert_discussion_points_100
      - exam_part.expert_discussion_grade

    Regeln:
      - wir werten nur Areas, die entweder points_100 ODER grade haben
      - Area-Punkte = points_100, sonst grade->points über grade_key
      - Gesamtpunkte = Durchschnitt über die bewerteten Areas (0..100)
      - Gesamtnote = points->grade über grade_key
    """
    part = db.query(ExamPart).filter(ExamPart.exam_part_id == exam_part_id).first()
    if not part:
        raise ValueError("ExamPart not found")

    # GradeKey laden
    gkv_id = _find_active_grade_key_version_id(db, subject_id)
    entries: List[GradeKeyEntry] = _load_grade_key_entries(db, gkv_id) if gkv_id else []

    # Areas laden
    areas = (
        db.query(ExamExpertDiscussionArea)
        .filter(ExamExpertDiscussionArea.exam_part_id == exam_part_id)
        .all()
    )

    area_points: List[Decimal] = []

    for a in areas:
        if a.points_100 is not None:
            area_points.append(_round2(Decimal(str(a.points_100))))
            continue

        if a.grade is not None:
            pts = _grade_to_points(entries, Decimal(str(a.grade)))
            if pts is not None:
                area_points.append(_round2(pts))

    if not area_points:
        part.expert_discussion_points_100 = None
        part.expert_discussion_grade = None
        db.add(part)
        db.commit()
        return None, None

    total_points = _round2(sum(area_points) / Decimal(len(area_points)))

    total_grade = _points_to_grade(entries, total_points)
    total_grade = _round2(total_grade) if total_grade is not None else None

    part.expert_discussion_points_100 = total_points
    part.expert_discussion_grade = total_grade

    db.add(part)
    db.commit()
    db.refresh(part)

    return total_points, total_grade
# End of backend/app/domains/exam/services/expert_discussion_calc_service.py