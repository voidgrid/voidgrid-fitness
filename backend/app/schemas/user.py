from typing import Optional
from pydantic import BaseModel, EmailStr

class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = True
    is_superuser: bool = False
    full_name: Optional[str] = None
    role: str = "user"

class UserCreate(UserBase):
    email: EmailStr
    password: str

class User(UserBase):
    id: int
    class Config:
        orm_mode = True
