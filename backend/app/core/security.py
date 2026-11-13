from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client
from app.core.config import get_settings

bearer_scheme = HTTPBearer(auto_error=False)


def get_supabase_public_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status_code=503, detail="Supabase authentication is not configured")
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_supabase_admin_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=503, detail="Supabase server access is not configured")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Bearer access token required")

    public_client = get_supabase_public_client()

    try:
        response = public_client.auth.get_user(credentials.credentials)
        user = response.user
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired access token") from exc

    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")

    try:
        profile_response = (
            get_supabase_admin_client()
            .table("profiles")
            .select("id, full_name, institutional_email, role, department_id, is_active")
            .eq("id", str(user.id))
            .single()
            .execute()
        )
        profile = profile_response.data
    except Exception as exc:
        raise HTTPException(status_code=403, detail="No SmartGrade profile is available for this account") from exc

    if not profile or not profile.get("is_active", False):
        raise HTTPException(status_code=403, detail="This SmartGrade account is inactive")

    return {"user": user, "profile": profile}
