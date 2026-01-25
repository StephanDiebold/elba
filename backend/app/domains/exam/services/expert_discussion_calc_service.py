# backend/app/domains/exam/services/expert_discussion_calc_service.py

from __future__ import annotations

from decimal import Decimal
from typing import Optional, Tuple, List

from sqlalchemy.orm import Session

from app.domains.exam.models import ExamPart, ExamExpertDiscussionArea

# WICHTIG: Wir nutzen die "einzige Wahrheit" aus expert_discussion_service.py
from app.domains.exam.services.expert_discussion_service import (
    _get_exam,
    _get_subject_id,
    _normalize_points,
    _p100_to_grade,
    _grade_to_p100_max,
)


def calculate_and_persist_expert_discussion_result(
    db: Session,
    exam_part_id: int,
    subject_id: Optional[int] = None,
) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    """
    Berechnet und persistiert:
      - exam_part.expert_discussion_points_100
      - exam_part.expert_discussion_grade

    Regeln (identisch zu expert_discussion_service.py):
      - wir werten nur Areas, die entweder points_100 ODER grade haben
      - Area-Punkte = points_100, sonst grade->points (MAX points per grade + 0.25 interpolation)
      - Gesamtpunkte = Durchschnitt über die bewerteten Areas (0..100), auf 2 Dezimal gerundet
      - Gesamtnote = points->grade via grade_key_entry (highest points_100 <= round(points))
    """

    part = db.query(ExamPart).filter(ExamPart.exam_part_id == exam_part_id).first()
    if not part:
        raise ValueError("ExamPart not found")

    # subject_id robust ermitteln, falls der Aufrufer falsch/None liefert
    if subject_id is None:
        if getattr(part, "exam_id", None) is None:
            raise ValueError("Cannot resolve subject_id: exam_part has no exam_id and subject_id not provided")
        exam = _get_exam(db, int(part.exam_id))
        subject_id = int(_get_subject_id(db, exam))

    # Areas laden
    areas: List[ExamExpertDiscussionArea] = (
        db.query(ExamExpertDiscussionArea)
        .filter(ExamExpertDiscussionArea.exam_part_id == exam_part_id)
        .all()
    )

    valid_points: List[float] = []

    for a in areas:
        # 1) points_100 direkt
        if a.points_100 is not None:
            valid_points.append(float(a.points_100))
            continue

        # 2) grade -> points (MAX points je Note, ggf. Interpolation)
        if a.grade is not None:
            pts = _grade_to_p100_max(db, int(subject_id), float(a.grade))
            if pts is not None:
                valid_points.append(float(pts))

    if not valid_points:
        part.expert_discussion_points_100 = None
        part.expert_discussion_grade = None
        db.commit()
        db.refresh(part)
        return None, None

    avg = _normalize_points(sum(valid_points) / float(len(valid_points)))
    part.expert_discussion_points_100 = Decimal(str(avg))

    g = _p100_to_grade(db, int(subject_id), float(avg))
    part.expert_discussion_grade = Decimal(str(g)) if g is not None else None

    db.commit()
    db.refresh(part)

    return part.expert_discussion_points_100, part.expert_discussion_grade
# End domain/services/expert_discussion_calc_service.py