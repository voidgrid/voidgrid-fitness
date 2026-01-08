from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import mimetypes
from app.core.config import settings
from app.api.v1.api import api_router
from app.db.session import engine, SessionLocal
from app.db.base_class import Base
from app.models import user, exercise, workout
from app.core.security import get_password_hash

# Explicitly register MIME types for 3D models
mimetypes.add_type("model/vnd.usdz+zip", ".usdz")
mimetypes.add_type("model/gltf-binary", ".glb")
mimetypes.add_type("model/gltf+json", ".gltf")
mimetypes.add_type("application/octet-stream", ".bin")

# Create tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(title="FitStack API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def create_initial_data():
    db = SessionLocal()
    try:
        if not settings.ADMIN_USER or not settings.ADMIN_USER_PASS:
            print("ADMIN_USER or ADMIN_USER_PASS not set. Skipping admin creation.")
            return

        admin = db.query(user.User).filter(user.User.email == settings.ADMIN_USER).first()
        if not admin:
            print(f"Creating initial superuser: {settings.ADMIN_USER}")
            db_obj = user.User(
                email=settings.ADMIN_USER,
                hashed_password=get_password_hash(settings.ADMIN_USER_PASS),
                full_name="Initial Admin",
                is_superuser=True,
                is_active=True,
                role="admin"
            )
            db.add(db_obj)
            db.commit()
    finally:
        db.close()

app.include_router(api_router, prefix=settings.API_V1_STR)

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(static_dir, "index.html"))
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))
else:
    @app.get("/")
    def root(): return {"message": "API Running. Frontend not found."}
