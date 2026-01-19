# app/domains/exam/services/expert_discussion_service.py

from __future__ import annotations

from decimal import Decimal
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.domains.exam.models import (
    Exam,
    ExamPart,
    GradeKeyVersion,
    GradeKeyEntry,
    # templates
    ExpertDiscussionArea,
    ExpertDiscussionItem,
    # instances
    ExamExpertDiscussionArea,
    ExamExpertDiscussionItem,
)

from app.domains.exam.services.grading_service import _resolve_subject_id


# -------------------------------------------------------------------
# GradeKey helpers (Teil 2 Fachgespräch)
# -------------------------------------------------------------------

def _get_active_grade_key_version_id(db: Session, subject_id: int) -> int:
    v = (
        db.query(GradeKeyVersion)
        .filter(
            GradeKeyVersion.subject_id == subject_id,
            GradeKeyVersion.is_active == True,  # noqa: E712
        )
        .order_by(GradeKeyVersion.valid_from.desc(), GradeKeyVersion.version_no.desc())
        .first()
    )
    if not v:
        raise ValueError(f"No active grade_key_version for subject_id={subject_id}")
    return int(v.grade_key_version_id)


def _p100_to_grade(db: Session, subject_id: int, points_100: float) -> Optional[float]:
    """
    points_100 -> grade_decimal
    Rule: take the grade for the highest points_100 <= input (classic IHK lookup).
    """
    p = float(points_100)
    p = max(0.0, min(100.0, p))

    version_id = _get_active_grade_key_version_id(db, subject_id)

    row = (
        db.query(GradeKeyEntry)
        .filter(GradeKeyEntry.grade_key_version_id == version_id)
        .filter(GradeKeyEntry.points_100 <= int(round(p)))
        .order_by(GradeKeyEntry.points_100.desc())
        .first()
    )
    if not row:
        row = (
            db.query(GradeKeyEntry)
            .filter(GradeKeyEntry.grade_key_version_id == version_id)
            .order_by(GradeKeyEntry.points_100.asc())
            .first()
        )
    if not row:
        return None
    return float(row.grade_decimal)


def _load_max_points_by_grade(db: Session, subject_id: int) -> Dict[float, int]:
    """
    For each grade_decimal, store the MAX points_100 of its allowed range.
    Implements: grade -> always take the "bigger" points.
    """
    version_id = _get_active_grade_key_version_id(db, subject_id)
    rows = (
        db.query(GradeKeyEntry.grade_decimal, GradeKeyEntry.points_100)
        .filter(GradeKeyEntry.grade_key_version_id == version_id)
        .all()
    )
    if not rows:
        raise ValueError(f"No grade_key_entry rows for grade_key_version_id={version_id}")

    tmp: Dict[float, List[int]] = {}
    for gd, p100 in rows:
        tmp.setdefault(float(gd), []).append(int(p100))

    return {gd: max(pts) for gd, pts in tmp.items()}


def _interpolate_linear(x: float, x0: float, y0: float, x1: float, y1: float) -> float:
    if x1 == x0:
        return y0
    t = (x - x0) / (x1 - x0)
    return y0 + t * (y1 - y0)


def _validate_grade_step_025(grade: float) -> None:
    q = round(grade / 0.25)
    if abs(grade - (q * 0.25)) > 1e-9:
        raise ValueError(f"grade step invalid: {grade} (expected step 0.25)")


def _grade_to_p100_max(db: Session, subject_id: int, grade: float) -> Optional[float]:
    """
    grade -> points_100 using MAX points per grade_decimal range.
    Supports 0.25 steps via linear interpolation between neighbor grade_decimals.
    """
    if grade is None:
        return None

    g = float(grade)
    g = max(1.0, min(6.0, g))
    _validate_grade_step_025(g)

    max_by_grade = _load_max_points_by_grade(db, subject_id)
    grades_sorted = sorted(max_by_grade.keys())
    if not grades_sorted:
        return None

    if g in max_by_grade:
        return float(max_by_grade[g])

    if g <= grades_sorted[0]:
        return float(max_by_grade[grades_sorted[0]])
    if g >= grades_sorted[-1]:
        return float(max_by_grade[grades_sorted[-1]])

    for i in range(len(grades_sorted) - 1):
        g0 = grades_sorted[i]
        g1 = grades_sorted[i + 1]
        if g0 <= g <= g1:
            return float(_interpolate_linear(g, g0, max_by_grade[g0], g1, max_by_grade[g1]))
    return None


def _normalize_points(points_100: float) -> float:
    p = float(points_100)
    p = max(0.0, min(100.0, p))
    return round(p, 2)


# -------------------------------------------------------------------
# Exam helpers
# -------------------------------------------------------------------

def _get_exam(db: Session, exam_id: int) -> Exam:
    exam = db.query(Exam).filter(Exam.exam_id == exam_id).first()
    if not exam:
        raise ValueError("Exam not found")
    return exam


def _get_part2_for_exam(db: Session, exam_id: int) -> ExamPart:
    part2 = (
        db.query(ExamPart)
        .filter(ExamPart.exam_id == exam_id, ExamPart.part_number == 2)
        .first()
    )
    if not part2:
        raise ValueError("ExamPart (part_number=2) not found for exam")
    return part2


def _get_subject_id(db: Session, exam: Exam) -> int:
    sid = _resolve_subject_id(exam)
    if sid is None:
        raise ValueError("No subject_id resolvable for this exam")
    return int(sid)


# -------------------------------------------------------------------
# Lazy init
# -------------------------------------------------------------------

def ensure_exam_expert_discussion_initialized(db: Session, exam_id: int) -> ExamPart:
    """
    Ensures:
    - For part 2: for each active template area, an exam_expert_discussion_area exists
    - For each exam area: at least one exam_expert_discussion_item exists
    """
    exam = _get_exam(db, exam_id)
    part2 = _get_part2_for_exam(db, exam_id)
    subject_id = _get_subject_id(db, exam)

    # active template areas
    tpl_areas: List[ExpertDiscussionArea] = (
        db.query(ExpertDiscussionArea)
        .filter(
            ExpertDiscussionArea.subject_id == subject_id,
            ExpertDiscussionArea.is_active == True,  # noqa: E712
        )
        .order_by(
            ExpertDiscussionArea.sort_order.asc(),
            ExpertDiscussionArea.area_id.asc(),
        )
        .all()
    )

    # if no templates -> keep empty (admin needs to fix)
    if not tpl_areas:
        return part2

    existing: List[ExamExpertDiscussionArea] = (
        db.query(ExamExpertDiscussionArea)
        .filter(ExamExpertDiscussionArea.exam_part_id == part2.exam_part_id)
        .all()
    )
    existing_by_tpl_area_id = {int(a.expert_discussion_area_id): a for a in existing}

    created_any = False
    for t in tpl_areas:
        tpl_area_id = int(t.area_id)
        if tpl_area_id in existing_by_tpl_area_id:
            continue

        db.add(
            ExamExpertDiscussionArea(
                exam_part_id=part2.exam_part_id,
                expert_discussion_area_id=tpl_area_id,
                # DB: expert_discussion_area.name
                area_title=t.name,
                points_100=None,
                grade=None,
            )
        )
        created_any = True

    if created_any:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()

    # ensure at least one item per exam area
    areas: List[ExamExpertDiscussionArea] = (
        db.query(ExamExpertDiscussionArea)
        .filter(ExamExpertDiscussionArea.exam_part_id == part2.exam_part_id)
        .options(selectinload(ExamExpertDiscussionArea.items))
        .order_by(ExamExpertDiscussionArea.exam_expert_discussion_area_id.asc())
        .all()
    )

    created_item = False
    for a in areas:
        if not a.items:
            db.add(
                ExamExpertDiscussionItem(
                    exam_expert_discussion_area_id=a.exam_expert_discussion_area_id,
                    # DB: exam_expert_discussion_item.template_item_id
                    template_item_id=None,
                    question_text="",
                    answer_text=None,
                    examiner_comment=None,
                    sort_order=1,
                )
            )
            created_item = True

    if created_item:
        db.commit()

    return part2


# -------------------------------------------------------------------
# Bundle for Router (Option A)
# -------------------------------------------------------------------

def get_expert_discussion_bundle(db: Session, exam_id: int) -> Dict[str, Any]:
    exam = _get_exam(db, exam_id)
    part2 = ensure_exam_expert_discussion_initialized(db, exam_id)
    subject_id = _get_subject_id(db, exam)

    # ----------------------------
    # Template Areas (Vorlagen)
    # expert_discussion_area: area_id, subject_id, code, name, description, expected_answer, ...
    # ----------------------------
    tpl_areas: List[ExpertDiscussionArea] = (
        db.query(ExpertDiscussionArea)
        .filter(
            ExpertDiscussionArea.subject_id == subject_id,
            ExpertDiscussionArea.is_active == True,  # noqa: E712
        )
        .order_by(ExpertDiscussionArea.sort_order.asc(), ExpertDiscussionArea.area_id.asc())
        .all()
    )
    tpl_by_id: Dict[int, ExpertDiscussionArea] = {int(t.area_id): t for t in tpl_areas}

    # ----------------------------
    # Template Items je Area
    # expert_discussion_item: item_id, area_id, item_text, sort_order, is_active
    # ----------------------------
    def _tpl_items(area_id: int) -> List[Dict[str, Any]]:
        rows: List[ExpertDiscussionItem] = (
            db.query(ExpertDiscussionItem)
            .filter(
                ExpertDiscussionItem.area_id == area_id,
                ExpertDiscussionItem.is_active == True,  # noqa: E712
            )
            .order_by(ExpertDiscussionItem.sort_order.asc(), ExpertDiscussionItem.item_id.asc())
            .all()
        )
        return [
            {
                "template_item_id": int(r.item_id),
                "item_text": r.item_text,
                "sort_order": int(r.sort_order),
            }
            for r in rows
        ]

    # ----------------------------
    # Exam Areas + Items
    # exam_expert_discussion_area: exam_expert_discussion_area_id, exam_part_id, expert_discussion_area_id, ...
    # exam_expert_discussion_item: exam_expert_discussion_item_id, exam_expert_discussion_area_id, template_item_id, question_text, ...
    # ----------------------------
    areas: List[ExamExpertDiscussionArea] = (
        db.query(ExamExpertDiscussionArea)
        .filter(ExamExpertDiscussionArea.exam_part_id == part2.exam_part_id)
        .options(selectinload(ExamExpertDiscussionArea.items))
        .order_by(ExamExpertDiscussionArea.exam_expert_discussion_area_id.asc())
        .all()
    )

    out_areas: List[Dict[str, Any]] = []
    for a in areas:
        tpl = tpl_by_id.get(int(a.expert_discussion_area_id))

        out_areas.append(
            {
                "exam_expert_discussion_area_id": int(a.exam_expert_discussion_area_id),
                "exam_part_id": int(a.exam_part_id),
                "expert_discussion_area_id": int(a.expert_discussion_area_id),
                "area_title": a.area_title,
                "points_100": float(a.points_100) if a.points_100 is not None else None,
                "grade": float(a.grade) if a.grade is not None else None,
                # Template meta (hints)
                "code": getattr(tpl, "code", None) if tpl else None,
                "description": getattr(tpl, "description", None) if tpl else None,
                "expected_answer": getattr(tpl, "expected_answer", None) if tpl else None,
                # Template items
                "template_items": _tpl_items(int(a.expert_discussion_area_id)),
                # Exam items
                "items": [
                    {
                        "exam_expert_discussion_item_id": int(i.exam_expert_discussion_item_id),
                        "exam_expert_discussion_area_id": int(i.exam_expert_discussion_area_id),
                        "template_item_id": int(i.template_item_id) if i.template_item_id is not None else None,
                        "question_text": i.question_text,
                        "answer_text": i.answer_text,
                        "examiner_comment": i.examiner_comment,
                        "sort_order": int(i.sort_order),
                    }
                    for i in (a.items or [])
                ],
            }
        )

    return {
        "exam_id": int(exam.exam_id),
        "exam_part_id": int(part2.exam_part_id),
        "subject_id": int(subject_id),
        "areas": out_areas,
    }


# -------------------------------------------------------------------
# Update area score
# -------------------------------------------------------------------

def update_exam_area_score(
    db: Session,
    exam_id: int,
    exam_area_id: int,
    *,
    mode: str,
    value: Optional[float],
) -> Dict[str, Any]:
    exam = _get_exam(db, exam_id)
    part2 = _get_part2_for_exam(db, exam_id)
    subject_id = _get_subject_id(db, exam)

    area: Optional[ExamExpertDiscussionArea] = (
        db.query(ExamExpertDiscussionArea)
        .filter(
            ExamExpertDiscussionArea.exam_part_id == part2.exam_part_id,
            ExamExpertDiscussionArea.exam_expert_discussion_area_id == exam_area_id,
        )
        .options(selectinload(ExamExpertDiscussionArea.items))
        .first()
    )
    if not area:
        raise ValueError("Exam expert discussion area not found")

    if mode == "points":
        if value is None:
            area.points_100 = None
            area.grade = None
        else:
            p = _normalize_points(value)
            area.points_100 = Decimal(str(p))
            g = _p100_to_grade(db, subject_id, p)
            area.grade = Decimal(str(g)) if g is not None else None

    elif mode == "grades":
        if value is None:
            area.grade = None
            area.points_100 = None
        else:
            g = float(value)
            area.grade = Decimal(str(g))
            p = _grade_to_p100_max(db, subject_id, g)
            area.points_100 = Decimal(str(p)) if p is not None else None

    else:
        raise ValueError("Invalid mode. Expected 'points' or 'grades'.")

    db.commit()
    db.refresh(area)

    # return as router expects (area out incl. items + template hints/items)
    bundle = get_expert_discussion_bundle(db, exam_id)
    for a in bundle["areas"]:
        if int(a["exam_expert_discussion_area_id"]) == int(exam_area_id):
            return a
    raise ValueError("Area updated but not found in bundle (unexpected)")


# -------------------------------------------------------------------
# Items CRUD
# -------------------------------------------------------------------

def create_item_answer(
    db: Session,
    exam_id: int,
    exam_area_id: int,
    *,
    template_item_id: Optional[int],
    question_text: Optional[str],
    answer_text: Optional[str],
    examiner_comment: Optional[str],
) -> Dict[str, Any]:
    _ = _get_part2_for_exam(db, exam_id)

    area = (
        db.query(ExamExpertDiscussionArea)
        .filter(ExamExpertDiscussionArea.exam_expert_discussion_area_id == exam_area_id)
        .first()
    )
    if not area:
        raise ValueError("Exam expert discussion area not found")

    max_sort = (
        db.query(func.max(ExamExpertDiscussionItem.sort_order))
        .filter(ExamExpertDiscussionItem.exam_expert_discussion_area_id == exam_area_id)
        .scalar()
    )
    next_sort = int(max_sort or 0) + 1

    q = (question_text or "").strip()

    # Wenn Template-Item gewählt und kein Text → Template-Text übernehmen
    if (not q) and template_item_id:
        tpl = (
            db.query(ExpertDiscussionItem)
            .filter(ExpertDiscussionItem.item_id == template_item_id)  # ✅ FIX
            .first()
        )
        if tpl:
            q = (tpl.item_text or "").strip()  # ✅ FIX

    item = ExamExpertDiscussionItem(
        exam_expert_discussion_area_id=exam_area_id,
        template_item_id=template_item_id,  # ✅ FIX (FK field in exam table)
        question_text=q,
        answer_text=answer_text,
        examiner_comment=examiner_comment,
        sort_order=next_sort,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return {
        "exam_expert_discussion_item_id": int(item.exam_expert_discussion_item_id),
        "exam_expert_discussion_area_id": int(item.exam_expert_discussion_area_id),
        "template_item_id": int(item.template_item_id) if item.template_item_id is not None else None,
        "question_text": item.question_text,
        "answer_text": item.answer_text,
        "examiner_comment": item.examiner_comment,
        "sort_order": int(item.sort_order),
    }



def update_item_answer(
    db: Session,
    exam_id: int,
    item_id: int,
    *,
    template_item_id: Optional[int] = None,
    question_text: Optional[str] = None,
    answer_text: Optional[str] = None,
    examiner_comment: Optional[str] = None,
    sort_order: Optional[int] = None,
) -> Dict[str, Any]:
    _ = _get_part2_for_exam(db, exam_id)

    item = (
        db.query(ExamExpertDiscussionItem)
        .filter(ExamExpertDiscussionItem.exam_expert_discussion_item_id == item_id)
        .first()
    )
    if not item:
        raise ValueError("Exam expert discussion item not found")

    if template_item_id is not None:
        item.template_item_id = template_item_id
        # autofill question if empty
        if (not (question_text or "").strip()) and template_item_id:
            t = (
                db.query(ExpertDiscussionItem)
                .filter(ExpertDiscussionItem.item_id == template_item_id)
                .first()
            )
            if t and (not (item.question_text or "").strip()):
                item.question_text = t.item_text

    if question_text is not None:
        item.question_text = question_text
    if answer_text is not None:
        item.answer_text = answer_text
    if examiner_comment is not None:
        item.examiner_comment = examiner_comment
    if sort_order is not None:
        item.sort_order = int(sort_order)

    db.commit()
    db.refresh(item)

    return {
        "exam_expert_discussion_item_id": int(item.exam_expert_discussion_item_id),
        "exam_expert_discussion_area_id": int(item.exam_expert_discussion_area_id),
        "template_item_id": int(item.template_item_id) if item.template_item_id is not None else None,
        "question_text": item.question_text,
        "answer_text": item.answer_text,
        "examiner_comment": item.examiner_comment,
        "sort_order": int(item.sort_order),
    }


def delete_item_answer(db: Session, exam_id: int, item_id: int) -> None:
    _ = _get_part2_for_exam(db, exam_id)

    item = (
        db.query(ExamExpertDiscussionItem)
        .filter(ExamExpertDiscussionItem.exam_expert_discussion_item_id == item_id)
        .first()
    )
    if not item:
        raise ValueError("Exam expert discussion item not found")

    db.delete(item)
    db.commit()


def delete_area(db: Session, exam_id: int, exam_area_id: int) -> None:
    part2 = _get_part2_for_exam(db, exam_id)
    area = (
        db.query(ExamExpertDiscussionArea)
        .filter(
            ExamExpertDiscussionArea.exam_part_id == part2.exam_part_id,
            ExamExpertDiscussionArea.exam_expert_discussion_area_id == exam_area_id,
        )
        .first()
    )
    if not area:
        raise ValueError("Exam expert discussion area not found")

    db.delete(area)
    db.commit()


# -------------------------------------------------------------------
# Submit / finalize Part 2 totals into exam_part
# -------------------------------------------------------------------

def submit_expert_discussion_part2(db: Session, exam_id: int) -> ExamPart:
    """
    Computes:
      expert_discussion_points_100 = AVG(points_100 over all areas that have points_100)
      expert_discussion_grade      = derived from grade_key via points_100
    Writes into exam_part and sets part.status='submitted' (MVP).
    """
    exam = _get_exam(db, exam_id)
    part2 = _get_part2_for_exam(db, exam_id)
    subject_id = _get_subject_id(db, exam)

    areas: List[ExamExpertDiscussionArea] = (
        db.query(ExamExpertDiscussionArea)
        .filter(ExamExpertDiscussionArea.exam_part_id == part2.exam_part_id)
        .all()
    )
    valid = [float(a.points_100) for a in areas if a.points_100 is not None]

    if not valid:
        part2.expert_discussion_points_100 = None
        part2.expert_discussion_grade = None
    else:
        avg = _normalize_points(sum(valid) / float(len(valid)))
        part2.expert_discussion_points_100 = Decimal(str(avg))
        g = _p100_to_grade(db, subject_id, avg)
        part2.expert_discussion_grade = Decimal(str(g)) if g is not None else None

    try:
        part2.status = "submitted"
    except Exception:
        pass

    db.commit()
    db.refresh(part2)
    return part2
# end of domains/exam/services/expert_discussion_service.py
