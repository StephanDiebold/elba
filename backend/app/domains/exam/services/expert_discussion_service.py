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

def ensure_exam_expert_discussion_initialized(
    db: Session,
    exam_id: int,
    *,
    default_area_id: int = 1,  # 1 = Fachlichkeit
) -> ExamPart:
    """
    MVP UX (aktuell gewünschtes Verhalten):
    - Bei erstem Öffnen wird nur die Default-Area (default_area_id=1) angelegt
    - Pro Area wird GENAU EINE leere Frage (ExamExpertDiscussionItem) angelegt
    - Template-Items (ExpertDiscussionItem) werden NICHT als Fragen instanziiert,
      sondern nur im Bundle als 'template_items' für Dropdown bereitgestellt.
    """
    exam = _get_exam(db, exam_id)
    part2 = _get_part2_for_exam(db, exam_id)
    subject_id = _get_subject_id(db, exam)

    tpl_area: Optional[ExpertDiscussionArea] = (
        db.query(ExpertDiscussionArea)
        .filter(
            ExpertDiscussionArea.subject_id == subject_id,
            ExpertDiscussionArea.area_id == int(default_area_id),
            ExpertDiscussionArea.is_active == True,  # noqa: E712
        )
        .first()
    )
    if not tpl_area:
        # Admin-Setup fehlt -> keine Auto-Anlage möglich
        return part2

    exam_area: Optional[ExamExpertDiscussionArea] = (
        db.query(ExamExpertDiscussionArea)
        .filter(
            ExamExpertDiscussionArea.exam_part_id == part2.exam_part_id,
            ExamExpertDiscussionArea.expert_discussion_area_id == int(tpl_area.area_id),
        )
        .options(selectinload(ExamExpertDiscussionArea.items))
        .first()
    )

    if not exam_area:
        exam_area = ExamExpertDiscussionArea(
            exam_part_id=part2.exam_part_id,
            expert_discussion_area_id=int(tpl_area.area_id),
            area_title=tpl_area.name,
            points_100=None,
            grade=None,
        )
        db.add(exam_area)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()

        exam_area = (
            db.query(ExamExpertDiscussionArea)
            .filter(
                ExamExpertDiscussionArea.exam_part_id == part2.exam_part_id,
                ExamExpertDiscussionArea.expert_discussion_area_id == int(tpl_area.area_id),
            )
            .options(selectinload(ExamExpertDiscussionArea.items))
            .first()
        )

    if not exam_area:
        return part2

    # IMPORTANT: pro Area nur 1 Item (leer) anlegen, nicht Template-Items "ausrollen"
    
    if not (exam_area.items or []):
        db.add(
            ExamExpertDiscussionItem(
                exam_expert_discussion_area_id=exam_area.exam_expert_discussion_area_id,
                template_item_id=None,
                question_text="",
                answer_text=None,
                examiner_comment=None,
                sort_order=1,
            )
        )
        db.commit()


    return part2


# -------------------------------------------------------------------
# Bundle for Router (Option A)
# -------------------------------------------------------------------

def get_expert_discussion_bundle(
    db: Session,
    exam_id: int,
    *,
    area_id: Optional[int] = None,
) -> Dict[str, Any]:
    exam = _get_exam(db, exam_id)
    part2 = ensure_exam_expert_discussion_initialized(db, exam_id)
    subject_id = _get_subject_id(db, exam)

    # ----------------------------
    # Template Areas (Vorlagen)
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
    # Template Items je Area (Dropdown-Hilfe)
    # ----------------------------
    def _tpl_items(area_id_: int) -> List[Dict[str, Any]]:
        rows: List[ExpertDiscussionItem] = (
            db.query(ExpertDiscussionItem)
            .filter(
                ExpertDiscussionItem.area_id == area_id_,
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
    # ----------------------------
    q = (
        db.query(ExamExpertDiscussionArea)
        .filter(ExamExpertDiscussionArea.exam_part_id == part2.exam_part_id)
        .options(selectinload(ExamExpertDiscussionArea.items))
        .order_by(ExamExpertDiscussionArea.exam_expert_discussion_area_id.asc())
    )

    # Optional filter: nur eine bestimmte Template-Area (z.B. area_id=1)
    if area_id is not None:
        q = q.filter(ExamExpertDiscussionArea.expert_discussion_area_id == int(area_id))

    areas: List[ExamExpertDiscussionArea] = q.all()

        # ----------------------------
    # Totals (Header): AVG(points_100) -> grade_key lookup
    # ----------------------------
    valid_points = [float(a.points_100) for a in areas if a.points_100 is not None]
    if valid_points:
        total_points_100 = _normalize_points(sum(valid_points) / float(len(valid_points)))
        total_grade = _p100_to_grade(db, subject_id, total_points_100)
    else:
        total_points_100 = None
        total_grade = None


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
                # Template items (Dropdown)
                "template_items": _tpl_items(int(a.expert_discussion_area_id)) if tpl else [],
                # Exam items (echte Protokoll-Fragen)
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
        "total_points_100": total_points_100,
        "total_grade": float(total_grade) if total_grade is not None else None,
        "areas": out_areas,
    }


def add_area_from_template(db: Session, exam_id: int, *, expert_discussion_area_id: int) -> Dict[str, Any]:
    """
    Creates a new ExamExpertDiscussionArea for part 2 based on a template area.

    IMPORTANT (UX):
    - creates exactly ONE empty ExamExpertDiscussionItem (question) as starting point
    - template items are NOT instantiated as questions; they are exposed via bundle.template_items
    """
    exam = _get_exam(db, exam_id)
    part2 = _get_part2_for_exam(db, exam_id)
    subject_id = _get_subject_id(db, exam)

    tpl_area: Optional[ExpertDiscussionArea] = (
        db.query(ExpertDiscussionArea)
        .filter(
            ExpertDiscussionArea.subject_id == subject_id,
            ExpertDiscussionArea.area_id == int(expert_discussion_area_id),
            ExpertDiscussionArea.is_active == True,  # noqa: E712
        )
        .first()
    )
    if not tpl_area:
        raise ValueError("Template area not found for this subject (or inactive)")

    exam_area = ExamExpertDiscussionArea(
        exam_part_id=part2.exam_part_id,
        expert_discussion_area_id=int(tpl_area.area_id),
        area_title=tpl_area.name,
        points_100=None,
        grade=None,
    )
    db.add(exam_area)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise ValueError("Area already exists for this exam/part")

    # IMPORTANT: only one empty item (not from template list)
    db.add(
        ExamExpertDiscussionItem(
            exam_expert_discussion_area_id=exam_area.exam_expert_discussion_area_id,
            template_item_id=None,
            question_text="",
            answer_text=None,
            examiner_comment=None,
            sort_order=1,
        )
    )

    db.commit()
    db.refresh(exam_area)

    # Return the new area as router expects
    bundle = get_expert_discussion_bundle(db, exam_id)
    for a in bundle["areas"]:
        if int(a["expert_discussion_area_id"]) == int(expert_discussion_area_id):
            return a

    return {
        "exam_expert_discussion_area_id": int(exam_area.exam_expert_discussion_area_id),
        "exam_part_id": int(exam_area.exam_part_id),
        "expert_discussion_area_id": int(exam_area.expert_discussion_area_id),
        "area_title": exam_area.area_title,
        "points_100": float(exam_area.points_100) if exam_area.points_100 is not None else None,
        "grade": float(exam_area.grade) if exam_area.grade is not None else None,
        "code": getattr(tpl_area, "code", None),
        "description": getattr(tpl_area, "description", None),
        "expected_answer": getattr(tpl_area, "expected_answer", None),
        "template_items": [],
        "items": [],
    }


def list_area_templates_for_exam(db: Session, exam_id: int) -> List[Dict[str, Any]]:
    """
    Lists active template areas for the exam's subject that are NOT yet created
    for this exam's part 2. This makes the UI robust against old DB state.
    """
    exam = _get_exam(db, exam_id)
    part2 = _get_part2_for_exam(db, exam_id)
    subject_id = _get_subject_id(db, exam)

    existing_ids = {
        int(x[0])
        for x in (
            db.query(ExamExpertDiscussionArea.expert_discussion_area_id)
            .filter(ExamExpertDiscussionArea.exam_part_id == part2.exam_part_id)
            .all()
        )
    }

    rows: List[ExpertDiscussionArea] = (
        db.query(ExpertDiscussionArea)
        .filter(
            ExpertDiscussionArea.subject_id == subject_id,
            ExpertDiscussionArea.is_active == True,  # noqa: E712
        )
        .order_by(ExpertDiscussionArea.sort_order.asc(), ExpertDiscussionArea.area_id.asc())
        .all()
    )

    out = []
    for a in rows:
        aid = int(a.area_id)
        if aid in existing_ids:
            continue
        out.append(
            {
                "expert_discussion_area_id": aid,
                "name": a.name,
                "sort_order": int(a.sort_order),
                "code": a.code,
            }
        )
    return out


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

    # Wenn Template-Item gewählt und kein Text → Template-Text übernehmen (UX)
    if (not q) and template_item_id:
        tpl = (
            db.query(ExpertDiscussionItem)
            .filter(ExpertDiscussionItem.item_id == template_item_id)
            .first()
        )
        if tpl:
            q = (tpl.item_text or "").strip()

    item = ExamExpertDiscussionItem(
        exam_expert_discussion_area_id=exam_area_id,
        template_item_id=template_item_id,
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

        # Autofill question if empty (nur wenn question_text nicht geliefert/leer)
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
# end domain/services/expert_discussion_service.py