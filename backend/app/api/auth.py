from fastapi import APIRouter, Depends
from app.core.security import get_current_user

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.get("/me")
def get_current_profile(context: dict = Depends(get_current_user)) -> dict:
    user = context["user"]
    return {
        "id": str(user.id),
        "email": user.email,
        "profile": context["profile"],
    }
