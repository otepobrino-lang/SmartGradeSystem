from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name, version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

app.include_router(health_router)
app.include_router(health_router, prefix=settings.api_v1_prefix)
app.include_router(auth_router, prefix=settings.api_v1_prefix)
