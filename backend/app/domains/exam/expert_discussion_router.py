# app/domains/exam/expert_discussion_router.py

from __future__ import annotations

from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.domains.auth.auth import get_current_user

from app.domains.exam.services.expert_discussion_service import (
    get_expert_discussion_bundle,
    update_exam_area_score,
    create_item_answer,
    update_item_answer,
    delete_item_answer,
    delete_area,
    submit_expert_discussion_part2,
    add_area_from_template,
    list_area_templates_for_exam,
)

router = APIRouter(prefix="", tags=["Exam: ExpertDiscussion"])


# -------------------------------------------------------------------
# Pydantic Out Models (MUST match service dict keys!)
# -------------------------------------------------------------------

class ExpertDiscussionTemplateItemOut(BaseModel):
    template_item_id: int
    item_text: str
    sort_order: int


class ExamExpertDiscussionItemOut(BaseModel):
    exam_expert_discussion_item_id: int
    exam_expert_discussion_area_id: int
    template_item_id: Optional[int] = None
    question_text: Optional[str] = None
    answer_text: Optional[str] = None
    examiner_comment: Optional[str] = None
    sort_order: int


class ExamExpertDiscussionAreaOut(BaseModel):
    exam_expert_discussion_area_id: int
    exam_part_id: int

    # NOTE: this is the template area FK (expert_discussion_area.area_id)
    expert_discussion_area_id: int
    area_title: str

    points_100: Optional[float] = None
    grade: Optional[float] = None

    # template meta
    code: Optional[str] = None
    description: Optional[str] = None
    expected_answer: Optional[str] = None

    template_items: List[ExpertDiscussionTemplateItemOut] = Field(default_factory=list)
    items: List[ExamExpertDiscussionItemOut] = Field(default_factory=list)


class ExpertDiscussionBundleOut(BaseModel):
    exam_part_id: int
    exam_id: int
    subject_id: int

    # WICHTIG: Wir liefern künftig standardmäßig nur 1 Area zurück (Fachlichkeit),
    # bleiben aber beim bestehenden Feld "areas" für Abwärtskompatibilität.
    areas: List[ExamExpertDiscussionAreaOut] = Field(default_factory=list)

class ExamExpertDiscussionAreaCreateIn(BaseModel):
    # Template area FK: ExpertDiscussionArea.area_id
    expert_discussion_area_id: int = Field(..., ge=1)

# -------------------------------------------------------------------
# In Models
# -------------------------------------------------------------------

class AreaScoreUpdateIn(BaseModel):
    mode: Literal["points", "grades"]
    points_100: Optional[float] = None
    grade: Optional[float] = None


class ExamExpertDiscussionItemCreateIn(BaseModel):
    template_item_id: Optional[int] = None
    question_text: Optional[str] = None
    answer_text: Optional[str] = None
    examiner_comment: Optional[str] = None


class ExamExpertDiscussionItemUpdateIn(BaseModel):
    template_item_id: Optional[int] = None
    question_text: Optional[str] = None
    answer_text: Optional[str] = None
    examiner_comment: Optional[str] = None
    sort_order: Optional[int] = None

# -------------------------------------------------------------------
# OUT model for template areas (dropdown)
# -------------------------------------------------------------------

class ExpertDiscussionAreaTemplateOut(BaseModel):
    expert_discussion_area_id: int
    name: str
    sort_order: int
    code: str | None = None



# -------------------------------------------------------------------
# Routes
# -------------------------------------------------------------------

from typing import Optional
from fastapi import Query

@router.get("/exams/{exam_id}/expert-discussion")
def api_get_bundle(
    exam_id: int,
    area_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    return get_expert_discussion_bundle(db, exam_id, area_id=area_id)



@router.patch("/exams/{exam_id}/expert-discussion/areas/{exam_area_id}", response_model=ExamExpertDiscussionAreaOut)
def api_update_area_score(
    exam_id: int,
    exam_area_id: int,
    payload: AreaScoreUpdateIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        if payload.mode == "points":
            value = payload.points_100
        else:
            value = payload.grade
        return update_exam_area_score(db, exam_id, exam_area_id, mode=payload.mode, value=value)
    except ValueError as ve:
        msg = str(ve)
        if "alredy exists" in msg:
            raise HTTPException(status_code=409, detail=msg)
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"expert discussion update area failed: {e}")


@router.post(
    "/exams/{exam_id}/expert-discussion/areas/{exam_area_id}/items",
    response_model=ExamExpertDiscussionItemOut,
)
def api_create_item(
    exam_id: int,
    exam_area_id: int,
    payload: ExamExpertDiscussionItemCreateIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        return create_item_answer(
            db,
            exam_id,
            exam_area_id,
            template_item_id=payload.template_item_id,
            question_text=payload.question_text,
            answer_text=payload.answer_text,
            examiner_comment=payload.examiner_comment,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"expert discussion create item failed: {e}")


@router.patch(
    "/exams/{exam_id}/expert-discussion/items/{item_id}",
    response_model=ExamExpertDiscussionItemOut,
)
def api_update_item(
    exam_id: int,
    item_id: int,
    payload: ExamExpertDiscussionItemUpdateIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        return update_item_answer(
            db,
            exam_id,
            item_id,
            template_item_id=payload.template_item_id,
            question_text=payload.question_text,
            answer_text=payload.answer_text,
            examiner_comment=payload.examiner_comment,
            sort_order=payload.sort_order,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"expert discussion update item failed: {e}")


@router.delete("/exams/{exam_id}/expert-discussion/items/{item_id}", status_code=204)
def api_delete_item(
    exam_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        delete_item_answer(db, exam_id, item_id)
        return
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"expert discussion delete item failed: {e}")


@router.delete("/exams/{exam_id}/expert-discussion/areas/{exam_area_id}", status_code=204)
def api_delete_area(
    exam_id: int,
    exam_area_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        delete_area(db, exam_id, exam_area_id)
        return
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"expert discussion delete area failed: {e}")


@router.post("/exams/{exam_id}/expert-discussion/submit")
def api_submit_part2(
    exam_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        part2 = submit_expert_discussion_part2(db, exam_id)
        return {
            "ok": True,
            "exam_part_id": int(part2.exam_part_id),
            "status": getattr(part2, "status", None),
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"expert discussion submit failed: {e}")
    
@router.post(
    "/exams/{exam_id}/expert-discussion/areas",
    response_model=ExamExpertDiscussionAreaOut,
)
def api_add_area(
    exam_id: int,
    payload: ExamExpertDiscussionAreaCreateIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Fügt eine neue Area (Exam-Instanz) hinzu, basierend auf einer Template-Area.
    Beispiel: payload.expert_discussion_area_id=2 (Pädagogik)
    """
    try:
        return add_area_from_template(db, exam_id, expert_discussion_area_id=payload.expert_discussion_area_id)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"expert discussion add area failed: {e}")    
    
@router.get(
    "/exams/{exam_id}/expert-discussion/area-templates",
    response_model=List[ExpertDiscussionAreaTemplateOut],
)
def api_list_area_templates(
    exam_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Returns all active template areas for the exam's subject.
    Used for the 'Neue Area hinzufügen' dropdown.
    """
    try:
        return list_area_templates_for_exam(db, exam_id)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"expert discussion list templates failed: {e}")

# end of domains/exam/expert_discussion_router.py