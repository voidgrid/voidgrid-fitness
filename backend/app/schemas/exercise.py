from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ExerciseBase(BaseModel):
    name: str
    categories: List[str]
    subcategories: List[str] = []
    tracking_type: str
    is_public: bool = False

class ExerciseCreate(ExerciseBase):
    pass

class Exercise(ExerciseBase):
    id: int
    owner_id: Optional[int] = None
    created_at: datetime
    class Config:
        orm_mode = True
