# app/domains/candidate/router.py

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.domains.candidate.models import Candidate
from app.domains.candidate import schemas

router = APIRouter(prefix="/candidate", tags=["Candidate"])

# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def _apply_candidate_filters(stmt, q: Optional[str], only_active: Optional[bool]):
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (Candidate.first_name.ilike(like)) | (Candidate.last_name.ilike(like))
        )
    if only_active is True:
        stmt = stmt.where(Candidate.is_active == True)  # noqa: E712
    return stmt

# -------------------------------------------------------------------
# LIST (alias: GET /candidate  und GET /candidate/candidates)
# -------------------------------------------------------------------

@router.get("", response_model=List[schemas.CandidateOut])
@router.get("/candidates", response_model=List[schemas.CandidateOut])
def list_candidates(
    q: Optional[str] = Query(None),
    only_active: Optional[bool] = Query(False),
    db: Session = Depends(get_db),
):
    stmt = select(Candidate)
    stmt = _apply_candidate_filters(stmt, q, only_active)
    stmt = stmt.order_by(Candidate.last_name.asc(), Candidate.first_name.asc())
    rows = db.execute(stmt).scalars().all()
    return rows

# -------------------------------------------------------------------
# DETAIL (GET /candidate/{candidate_id})
# -------------------------------------------------------------------

@router.get("/{candidate_id}", response_model=schemas.CandidateOut)
def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
    cand = db.get(Candidate, candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return cand

# -------------------------------------------------------------------
# CREATE (alias: POST /candidate  und POST /candidate/candidates)
# -------------------------------------------------------------------

@router.post(
    "",
    response_model=schemas.CandidateOut,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/candidates",
    response_model=schemas.CandidateOut,
    status_code=status.HTTP_201_CREATED,
)
def create_candidate(
    payload: schemas.CandidateCreate,
    db: Session = Depends(get_db),
):
    cand = Candidate(**payload.model_dump())
    db.add(cand)
    db.commit()
    db.refresh(cand)
    return cand

# -------------------------------------------------------------------
# UPDATE (PUT/PATCH /candidate/{candidate_id})
# -------------------------------------------------------------------

@router.put("/{candidate_id}", response_model=schemas.CandidateOut)
@router.patch("/{candidate_id}", response_model=schemas.CandidateOut)
def update_candidate(
    candidate_id: int,
    payload: schemas.CandidateUpdate,
    db: Session = Depends(get_db),
):
    cand = db.get(Candidate, candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cand, k, v)

    db.add(cand)
    db.commit()
    db.refresh(cand)
    return cand

# -------------------------------------------------------------------
# DELETE (DELETE /candidate/{candidate_id})
# -------------------------------------------------------------------

@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_candidate(candidate_id: int, db: Session = Depends(get_db)):
    cand = db.get(Candidate, candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    db.delete(cand)
    db.commit()
    return

# End of file
