from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app import models, schemas
from app.api import deps
from app.db.session import get_db

router = APIRouter()

@router.get("/", response_model=List[schemas.Exercise])
def read_exercises(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    return db.query(models.Exercise).filter(
        or_(
            models.Exercise.owner_id == current_user.id,
            models.Exercise.is_public == True
        )
    ).offset(skip).limit(limit).all()

@router.post("/", response_model=schemas.Exercise)
def create_exercise(
    *,
    db: Session = Depends(get_db),
    exercise_in: schemas.ExerciseCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    db_obj = models.Exercise(
        **exercise_in.model_dump(),
        owner_id=current_user.id
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.delete("/{id}", response_model=schemas.Exercise)
def delete_exercise(
    *,
    db: Session = Depends(get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    obj = db.query(models.Exercise).get(id)
    if not obj:
        return None
    if obj.owner_id != current_user.id:
        return None
    db.delete(obj)
    db.commit()
    return obj
