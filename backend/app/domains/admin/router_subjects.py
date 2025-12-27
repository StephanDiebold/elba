# backend/app/domains/admin/router_subjects.py

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.domains.common.models_subject import Subject

router = APIRouter(prefix="/admin", tags=["Administration – Subjects"])


@router.get("/subjects", response_model=list[dict])
def list_subjects(
    db: Session = Depends(get_db),
    search: str | None = Query(None),
):
    q = db.query(Subject)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (Subject.code.ilike(like)) | (Subject.display_name_de.ilike(like))
        )
    rows = q.order_by(Subject.display_name_de.asc()).all()

    # bewusst einfach (kein Schema nötig für den Start)
    return [
        {
            "subject_id": s.subject_id,
            "code": s.code,
            "display_name_de": s.display_name_de,
        }
        for s in rows
    ]
