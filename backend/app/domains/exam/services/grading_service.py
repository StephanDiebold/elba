# app/domains/exam/services/grading_service.py

from __future__ import annotations

from decimal import Decimal
from typing import List, Dict, Optional, Tuple
from statistics import mean

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.domains.exam.models import (
    Exam,
    ExamPart,
    ExamGradingSheet,
    ExamGradingItem,
    GradingSheetDefinition,
    GradingCriterionDefinition,
)

from app.domains.exam.schemas import (
    FinalSheetOut,
    FinalCriterionOut,
    MemberRatingOut,
    GradingSheetUpdateIn,
    FinalSheetDecisionIn,
    FinalCriterionDecisionIn,
)

from app.domains.auth.models import User  # ggf. Pfad anpassen


# --------- Hilfsfunktionen ---------


def _get_subject_id_for_exam_type(exam_type: str) -> Optional[int]:
    """Hardcoded Mapping exam_type -> subject_id (für AEVO etc.)."""
    mapping = {
        "aevo": 1,  # <- ID deines AEVO-Subjects in der DB
        # "wfw": 2,
        # "it":  3,
    }
    return mapping.get(exam_type)


def _get_active_sheet_definition_for_part(
    db: Session, exam: Exam, part: ExamPart
) -> GradingSheetDefinition:
    """
    Ermittelt das passende grading_sheet_definition für einen Prüfungsteil.
    Aktuell: 1 aktives Template je Subject + part_number.
    Später kann hier z.B. part_mode (presentation/demonstration) berücksichtigt werden.
    """
    subject_id = _get_subject_id_for_exam_type(exam.exam_type)
    if subject_id is None:
        raise ValueError(f"Kein subject_id für exam_type {exam.exam_type} definiert")

    q = (
        db.query(GradingSheetDefinition)
        .filter(
            GradingSheetDefinition.subject_id == subject_id,
            GradingSheetDefinition.part_number == part.part_number,
            GradingSheetDefinition.is_active == True,  # noqa: E712
        )
        .order_by(GradingSheetDefinition.version_no.desc())
    )
    sheet_def = q.first()
    if not sheet_def:
        raise ValueError(
            f"Keine aktive grading_sheet_definition für subject_id={subject_id}, "
            f"part_number={part.part_number}"
        )
    return sheet_def


def _compute_points_from_grade(max_points: int, grade: Optional[float]) -> Optional[Decimal]:
    """
    Einfache lineare Abbildung Note -> Punkte.
    1.0 => 100%, 6.0 => 0%
    """
    if grade is None:
        return None
    try:
        g = float(grade)
    except (TypeError, ValueError):
        return None

    # Klammern
    if g < 1.0:
        g = 1.0
    if g > 6.0:
        g = 6.0

    factor = 1.0 - (g - 1.0) / 5.0  # zwischen 1 und 6
    points = max_points * factor
    return Decimal(round(points, 2))


# --------- Member-Sheets (einzelne Prüfer) ---------


def get_or_create_member_sheet(
    db: Session,
    exam_part_id: int,
    examiner_id: int,
) -> ExamGradingSheet:
    """
    Liefert das member-Sheet für einen Prüfer zu einem Prüfungsteil.
    Falls noch keines existiert, wird es mit allen Items angelegt.
    """
    part: ExamPart = (
        db.query(ExamPart)
        .options(joinedload(ExamPart.exam))
        .filter(ExamPart.exam_part_id == exam_part_id)
        .first()
    )
    if not part:
        raise ValueError("ExamPart not found")

    exam: Exam = part.exam

    sheet: ExamGradingSheet = (
        db.query(ExamGradingSheet)
        .filter(
            ExamGradingSheet.exam_part_id == exam_part_id,
            ExamGradingSheet.examiner_id == examiner_id,
            ExamGradingSheet.sheet_type == "member",
        )
        .first()
    )
    if sheet:
        return sheet

    # passende Definition für diesen Teil finden
    sheet_def = _get_active_sheet_definition_for_part(db, exam, part)

    # neues Sheet anlegen
    sheet = ExamGradingSheet(
        exam_part_id=exam_part_id,
        grading_sheet_definition_id=sheet_def.grading_sheet_definition_id,
        examiner_id=examiner_id,
        sheet_type="member",
        status="draft",
        total_points=Decimal("0.0"),
        total_grade=None,
    )
    db.add(sheet)
    db.flush()  # damit sheet_id vorhanden ist

    # Items nach Definition anlegen
    crit_defs: List[GradingCriterionDefinition] = (
        db.query(GradingCriterionDefinition)
        .filter(
            GradingCriterionDefinition.grading_sheet_definition_id
            == sheet_def.grading_sheet_definition_id
        )
        .order_by(GradingCriterionDefinition.criterion_number)
        .all()
    )

    for cd in crit_defs:
        item = ExamGradingItem(
            exam_grading_sheet_id=sheet.exam_grading_sheet_id,
            grading_criterion_definition_id=cd.grading_criterion_definition_id,
            points=None,
            grade=None,
            comment=None,
        )
        db.add(item)

    db.commit()
    db.refresh(sheet)
    return sheet


def update_grading_sheet_items(
    db: Session,
    sheet_id: int,
    items_data: List[Dict],
) -> ExamGradingSheet:
    """
    Aktualisiert Punkte/Noten/Kommentare im Sheet und berechnet total_points/total_grade neu.
    items_data: Liste aus {exam_grading_item_id, grade?, points?, comment?}
    """
    sheet: ExamGradingSheet = (
        db.query(ExamGradingSheet)
        .options(joinedload(ExamGradingSheet.items).joinedload(ExamGradingItem.criterion))
        .filter(ExamGradingSheet.exam_grading_sheet_id == sheet_id)
        .first()
    )
    if not sheet:
        raise ValueError("ExamGradingSheet not found")

    if sheet.status == "locked":
        raise ValueError("Sheet is locked and cannot be changed")

    items_by_id: Dict[int, ExamGradingItem] = {
        it.exam_grading_item_id: it for it in sheet.items
    }

    for payload in items_data:
        item_id = payload.get("exam_grading_item_id")
        if item_id is None or item_id not in items_by_id:
            continue
        item = items_by_id[item_id]

        grade = payload.get("grade")
        points = payload.get("points")
        comment = payload.get("comment")

        if grade is not None:
            item.grade = Decimal(str(grade))

            # falls Punkte nicht explizit gesendet wurden: Vorschlag berechnen
            if points is None:
                max_points = item.criterion.max_points
                points_suggested = _compute_points_from_grade(max_points, float(grade))
                item.points = points_suggested
        if points is not None:
            item.points = Decimal(str(points))

        if comment is not None:
            item.comment = comment

    # totals neu berechnen
    valid_points = [it.points for it in sheet.items if it.points is not None]
    if valid_points:
        total_points = sum(valid_points)
    else:
        total_points = Decimal("0.0")

    # Durchschnittsnote über alle Kriterien (optional)
    valid_grades = [it.grade for it in sheet.items if it.grade is not None]
    avg_grade: Optional[Decimal] = (
        Decimal(str(round(mean([float(g) for g in valid_grades]), 2)))
        if valid_grades
        else None
    )

    sheet.total_points = total_points
    sheet.total_grade = avg_grade

    db.commit()
    db.refresh(sheet)
    return sheet


def update_member_sheet(
    db: Session,
    sheet_id: int,
    examiner_id: int,
    payload: GradingSheetUpdateIn,
) -> ExamGradingSheet:
    """
    Wrapper um update_grading_sheet_items mit:
    - Ownership-Check (sheet gehört current_user?)
    - sheet_type == 'member'
    - Verwendung von GradingSheetUpdateIn
    """
    sheet: ExamGradingSheet = (
        db.query(ExamGradingSheet)
        .filter(ExamGradingSheet.exam_grading_sheet_id == sheet_id)
        .first()
    )
    if not sheet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ExamGradingSheet {sheet_id} not found",
        )

    if sheet.sheet_type != "member":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only member grading sheets can be updated via this endpoint",
        )

    if sheet.examiner_id != examiner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to modify this grading sheet",
        )

    items_data: List[Dict] = []
    for item in payload.items:
        items_data.append(
            {
                "exam_grading_item_id": item.exam_grading_item_id,
                "grade": item.grade,
                "points": item.points,
                "comment": item.comment,
            }
        )

    return update_grading_sheet_items(db=db, sheet_id=sheet_id, items_data=items_data)


def submit_member_sheet(
    db: Session,
    sheet_id: int,
    examiner_id: int,
) -> Tuple[ExamGradingSheet, bool]:
    """
    Setzt ein member-Sheet auf 'submitted'.
    Gibt zurück:
      (sheet, all_submitted_for_part)
    """
    sheet: ExamGradingSheet = db.query(ExamGradingSheet).filter(
        ExamGradingSheet.exam_grading_sheet_id == sheet_id
    ).first()
    if not sheet:
        raise ValueError("ExamGradingSheet not found")

    if sheet.sheet_type != "member":
        raise ValueError("Only member sheets can be submitted")

    if sheet.examiner_id != examiner_id:
        raise ValueError("Sheet does not belong to this examiner")

    sheet.status = "submitted"
    db.commit()
    db.refresh(sheet)

    # prüfen, ob alle member-Sheets für diesen Teil submitted sind
    part_id = sheet.exam_part_id
    q = db.query(ExamGradingSheet).filter(
        ExamGradingSheet.exam_part_id == part_id,
        ExamGradingSheet.sheet_type == "member",
    )
    statuses = [s.status for s in q.all()]
    all_submitted = bool(statuses) and all(st == "submitted" for st in statuses)
    return sheet, all_submitted


# --------- Final Sheet (Ausschuss-Bogen) ---------


class FinalCriterionView:
    def __init__(
        self,
        criterion: GradingCriterionDefinition,
        member_ratings: List[MemberRatingOut],
        decided_item: Optional[ExamGradingItem],
    ):
        self.criterion = criterion
        self.member_ratings = member_ratings
        self.decided_item = decided_item

        self.suggested_points: Optional[Decimal] = None
        self.suggested_grade: Optional[Decimal] = None
        self.decided_points: Optional[Decimal] = None
        self.decided_grade: Optional[Decimal] = None
        self.combined_comment: Optional[str] = None

        self.max_grade_diff: Optional[Decimal] = None
        self.max_points_diff: Optional[Decimal] = None
        self.has_conflict: bool = False

        self._compute_aggregates()

    def _compute_aggregates(self) -> None:
        grades = [
            Decimal(str(r.grade))
            for r in self.member_ratings
            if r.grade is not None
        ]
        points = [
            Decimal(str(r.points))
            for r in self.member_ratings
            if r.points is not None
        ]

        # vorgeschlagene Punkte/Note
        if points:
            self.suggested_points = Decimal(
                str(round(mean([float(p) for p in points]), 2))
            )
        if grades:
            self.suggested_grade = Decimal(
                str(round(mean([float(g) for g in grades]), 2))
            )

        # Differenzen
        if grades:
            min_g, max_g = min(grades), max(grades)
            self.max_grade_diff = Decimal(str(round(float(max_g - min_g), 2)))
        if points:
            min_p, max_p = min(points), max(points)
            self.max_points_diff = Decimal(str(round(float(max_p - min_p), 2)))

        # Konfliktregel: mehr als 1 Note Unterschied
        if self.max_grade_diff is not None and float(self.max_grade_diff) > 1.0:
            self.has_conflict = True

        # beschlossene Werte: aus final-Item, sonst Vorschlag
        if self.decided_item:
            self.decided_points = self.decided_item.points
            self.decided_grade = self.decided_item.grade
            self.combined_comment = self.decided_item.comment
        else:
            self.decided_points = self.suggested_points
            self.decided_grade = self.suggested_grade
            # default combined_comment: alle Einzelkommentare untereinander
            comments = [
                f"{r.examiner_name}: {r.comment}"
                for r in self.member_ratings
                if r.comment
            ]
            self.combined_comment = "\n".join(comments) if comments else None


def build_final_sheet_view(
    db: Session,
    exam_part_id: int,
) -> FinalSheetOut:
    """
    Aggregiert alle member-Sheets und optional das final-Sheet
    zu einer Struktur für den Final-View (FinalSheetOut).
    """
    part: ExamPart = (
        db.query(ExamPart)
        .options(joinedload(ExamPart.exam))
        .filter(ExamPart.exam_part_id == exam_part_id)
        .first()
    )
    if not part:
        raise ValueError("ExamPart not found")

    exam: Exam = part.exam
    sheet_def = _get_active_sheet_definition_for_part(db, exam, part)

    # alle Kriterien
    crit_defs: List[GradingCriterionDefinition] = (
        db.query(GradingCriterionDefinition)
        .filter(
            GradingCriterionDefinition.grading_sheet_definition_id
            == sheet_def.grading_sheet_definition_id
        )
        .order_by(GradingCriterionDefinition.criterion_number)
        .all()
    )

    # member-Sheets + Items
    member_sheets: List[ExamGradingSheet] = (
        db.query(ExamGradingSheet)
        .options(
            joinedload(ExamGradingSheet.items).joinedload(
                ExamGradingItem.criterion
            ),
            joinedload(ExamGradingSheet.examiner),
        )
        .filter(
            ExamGradingSheet.exam_part_id == exam_part_id,
            ExamGradingSheet.sheet_type == "member",
        )
        .all()
    )

    # final-Sheet (falls schon existiert)
    final_sheet: Optional[ExamGradingSheet] = (
        db.query(ExamGradingSheet)
        .options(joinedload(ExamGradingSheet.items))
        .filter(
            ExamGradingSheet.exam_part_id == exam_part_id,
            ExamGradingSheet.sheet_type == "final",
        )
        .first()
    )

    decided_by_criterion: Dict[int, ExamGradingItem] = {}
    if final_sheet:
        for it in final_sheet.items:
            decided_by_criterion[it.grading_criterion_definition_id] = it

    final_criteria_out: List[FinalCriterionOut] = []

    for cd in crit_defs:
        # member_ratings pro Kriterium sammeln
        member_ratings: List[MemberRatingOut] = []

        for sheet in member_sheets:
            item = next(
                (
                    it
                    for it in sheet.items
                    if it.grading_criterion_definition_id
                    == cd.grading_criterion_definition_id
                ),
                None,
            )
            if not item:
                continue

            examiner: Optional[User] = sheet.examiner
            if examiner:
                examiner_name = (
                    getattr(examiner, "display_name", None)
                    or " ".join(
                        filter(
                            None,
                            [
                                getattr(examiner, "first_name", None),
                                getattr(examiner, "last_name", None),
                            ],
                        )
                    )
                    or getattr(examiner, "email", f"User {examiner.user_id}")
                )
                examiner_id = examiner.user_id
            else:
                examiner_name = ""
                examiner_id = 0

            member_ratings.append(
                MemberRatingOut(
                    examiner_id=examiner_id,
                    examiner_name=examiner_name,
                    grade=float(item.grade) if item.grade is not None else None,
                    points=float(item.points) if item.points is not None else None,
                    comment=item.comment,
                )
            )

        decided_item = decided_by_criterion.get(
            cd.grading_criterion_definition_id
        )
        view = FinalCriterionView(
            criterion=cd,
            member_ratings=member_ratings,
            decided_item=decided_item,
        )

        final_criteria_out.append(
            FinalCriterionOut(
                criterion_id=cd.grading_criterion_definition_id,
                criterion_number=cd.criterion_number,
                title=cd.title,
                description=cd.description,
                max_points=cd.max_points,
                member_ratings=member_ratings,
                suggested_points=float(view.suggested_points)
                if view.suggested_points is not None
                else None,
                suggested_grade=float(view.suggested_grade)
                if view.suggested_grade is not None
                else None,
                decided_points=float(view.decided_points)
                if view.decided_points is not None
                else None,
                decided_grade=float(view.decided_grade)
                if view.decided_grade is not None
                else None,
                combined_comment=view.combined_comment,
                max_grade_diff=float(view.max_grade_diff)
                if view.max_grade_diff is not None
                else None,
                max_points_diff=float(view.max_points_diff)
                if view.max_points_diff is not None
                else None,
                has_conflict=view.has_conflict,
            )
        )

    return FinalSheetOut(
        exam_part_id=part.exam_part_id,
        exam_id=part.exam_id,
        part_number=part.part_number,
        title=part.title,
        status=part.status,
        final_sheet_id=final_sheet.exam_grading_sheet_id if final_sheet else None,
        criteria=final_criteria_out,
    )

def save_final_sheet_decisions(
    db: Session,
    exam_part_id: int,
    decisions: FinalSheetDecisionIn,
) -> ExamGradingSheet:
    """
    Legt den finalen Ausschuss-Bogen (sheet_type='final') für einen Prüfungsteil an
    oder aktualisiert ihn und schreibt die beschlossenen Punkte/Noten/Kommentare
    pro Kriterium hinein.
    """
    # Prüfungsteil + zugehörige Prüfung holen
    part: ExamPart = (
        db.query(ExamPart)
        .options(joinedload(ExamPart.exam))
        .filter(ExamPart.exam_part_id == exam_part_id)
        .first()
    )
    if not part:
        raise ValueError("ExamPart not found")

    exam: Exam = part.exam
    sheet_def = _get_active_sheet_definition_for_part(db, exam, part)

    # Final-Sheet holen oder neu anlegen
    final_sheet: ExamGradingSheet = (
        db.query(ExamGradingSheet)
        .options(joinedload(ExamGradingSheet.items))
        .filter(
            ExamGradingSheet.exam_part_id == exam_part_id,
            ExamGradingSheet.sheet_type == "final",
        )
        .first()
    )

    if not final_sheet:
        final_sheet = ExamGradingSheet(
            exam_part_id=exam_part_id,
            grading_sheet_definition_id=sheet_def.grading_sheet_definition_id,
            examiner_id=None,  # Ausschuss als Ganzes
            sheet_type="final",
            status="draft",
            total_points=None,
            total_grade=None,
        )
        db.add(final_sheet)
        db.flush()  # sheet_id verfügbar machen

    # Sicherstellen, dass für alle Kriterien Items im final sheet existieren
    crit_defs: List[GradingCriterionDefinition] = (
        db.query(GradingCriterionDefinition)
        .filter(
            GradingCriterionDefinition.grading_sheet_definition_id
            == sheet_def.grading_sheet_definition_id
        )
        .order_by(GradingCriterionDefinition.criterion_number)
        .all()
    )

    items_by_criterion: Dict[int, ExamGradingItem] = {
        it.grading_criterion_definition_id: it for it in final_sheet.items
    }

    # ggf. fehlende Items anlegen
    for cd in crit_defs:
        if cd.grading_criterion_definition_id not in items_by_criterion:
            item = ExamGradingItem(
                exam_grading_sheet_id=final_sheet.exam_grading_sheet_id,
                grading_criterion_definition_id=cd.grading_criterion_definition_id,
                points=None,
                grade=None,
                comment=None,
            )
            db.add(item)
            db.flush()
            items_by_criterion[cd.grading_criterion_definition_id] = item

    # Entscheidungen anwenden
    for c in decisions.criteria:
        crit_id = c.criterion_id
        item = items_by_criterion.get(crit_id)
        if not item:
            # Falls jemand eine Criterion-ID sendet, die es in diesem Bogen nicht gibt – ignorieren
            continue

        if c.decided_points is not None:
            item.points = Decimal(str(c.decided_points))

        if c.decided_grade is not None:
            item.grade = Decimal(str(c.decided_grade))

        if c.combined_comment is not None:
            item.comment = c.combined_comment

    # Totals neu berechnen
    valid_points = [it.points for it in items_by_criterion.values() if it.points is not None]
    if valid_points:
        total_points = sum(valid_points)
    else:
        total_points = None

    valid_grades = [it.grade for it in items_by_criterion.values() if it.grade is not None]
    avg_grade: Optional[Decimal] = (
        Decimal(str(round(mean([float(g) for g in valid_grades]), 2)))
        if valid_grades
        else None
    )

    final_sheet.total_points = total_points
    final_sheet.total_grade = avg_grade

    # Status: finaler Beschluss -> locked (oder 'decided', je nach deiner Konvention)
    final_sheet.status = "locked"

    db.commit()
    db.refresh(final_sheet)
    return final_sheet


# End of file
