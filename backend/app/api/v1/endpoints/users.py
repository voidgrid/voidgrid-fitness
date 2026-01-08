from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app import models, schemas
from app.api import deps
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db

router = APIRouter()

@router.get("/config")
def get_auth_config() -> Any:
    oidc_enabled = bool(settings.OIDC_CLIENT_ID and settings.OIDC_DISCOVERY_URL)
    return {
        "allow_registration": settings.ALLOW_REGISTRATION,
        "allow_password_login": settings.ALLOW_PASSWORD_LOGIN,
        "oidc_enabled": oidc_enabled
    }

@router.post("/login/access-token")
def login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    if not settings.ALLOW_PASSWORD_LOGIN:
        user = db.query(models.User).filter(models.User.email == form_data.username).first()
        if not user or not user.is_superuser:
             raise HTTPException(status_code=403, detail="Password login is disabled")

    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is inactive or pending approval")
        
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
    }

@router.post("/register", response_model=schemas.User)
def create_user(
    *,
    db: Session = Depends(get_db),
    user_in: schemas.UserCreate,
) -> Any:
    if not settings.ALLOW_REGISTRATION:
        raise HTTPException(status_code=403, detail="Registration is currently disabled")

    user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if user:
        raise HTTPException(status_code=400, detail="The user with this email already exists")
    
    db_obj = models.User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        is_active=False,
        is_superuser=user_in.is_superuser,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.get("/me", response_model=schemas.User)
def read_user_me(
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    return current_user

@router.get("/", response_model=List[schemas.User])
def read_users(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users

@router.put("/{user_id}", response_model=schemas.User)
def update_user(
    *,
    db: Session = Depends(get_db),
    user_id: int,
    user_in: schemas.UserUpdate,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    if user_in.role is not None:
        user.role = user_in.role
    db.commit()
    db.refresh(user)
    return user

@router.get("/login/oidc")
def login_oidc(request: Request):
    if not settings.OIDC_CLIENT_ID or not settings.OIDC_DISCOVERY_URL:
        raise HTTPException(status_code=500, detail="OIDC not configured")
    return {"message": "OIDC Configured."}

@router.get("/login/oidc/callback")
def login_oidc_callback(request: Request, db: Session = Depends(get_db)):
    return {"message": "OIDC Callback not implemented"}
