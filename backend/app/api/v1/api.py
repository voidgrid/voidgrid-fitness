from fastapi import APIRouter
from app.api.v1.endpoints import users, exercises

api_router = APIRouter()
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(exercises.router, prefix="/exercises", tags=["exercises"])
