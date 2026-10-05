from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db, User, UserSetting
from app.auth.utils import get_current_user
from app.config import GEMINI_API_KEY, OPENAI_API_KEY, GROQ_API_KEY

router = APIRouter(prefix="/api/settings", tags=["Settings"])


class UpdateSettingsRequest(BaseModel):
    llm_provider: str
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    embedding_provider: Optional[str] = "local_dense"
    top_k: Optional[int] = 4


def mask_key(key: Optional[str]) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "********"
    return f"{key[:4]}...{key[-4:]}"


@router.get("")
def get_user_settings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    setting = db.query(UserSetting).filter(UserSetting.user_id == user.id).first()
    if not setting:
        setting = UserSetting(user_id=user.id)
        db.add(setting)
        db.commit()
        db.refresh(setting)

    # Check if system-wide environment key is set
    has_env_gemini = bool(GEMINI_API_KEY)
    has_env_openai = bool(OPENAI_API_KEY)
    has_env_groq = bool(GROQ_API_KEY)

    return {
        "llm_provider": setting.llm_provider,
        "embedding_provider": setting.embedding_provider,
        "top_k": setting.top_k,
        "temperature": setting.temperature,
        "keys": {
            "has_gemini": bool(setting.gemini_api_key) or has_env_gemini,
            "gemini_masked": mask_key(setting.gemini_api_key or GEMINI_API_KEY),
            "has_openai": bool(setting.openai_api_key) or has_env_openai,
            "openai_masked": mask_key(setting.openai_api_key or OPENAI_API_KEY),
            "has_groq": bool(setting.groq_api_key) or has_env_groq,
            "groq_masked": mask_key(setting.groq_api_key or GROQ_API_KEY),
        },
    }


@router.put("")
def update_user_settings(
    req: UpdateSettingsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    setting = db.query(UserSetting).filter(UserSetting.user_id == user.id).first()
    if not setting:
        setting = UserSetting(user_id=user.id)
        db.add(setting)

    setting.llm_provider = req.llm_provider
    if req.gemini_api_key is not None and req.gemini_api_key != "********":
        setting.gemini_api_key = req.gemini_api_key.strip()
    if req.openai_api_key is not None and req.openai_api_key != "********":
        setting.openai_api_key = req.openai_api_key.strip()
    if req.groq_api_key is not None and req.groq_api_key != "********":
        setting.groq_api_key = req.groq_api_key.strip()

    if req.embedding_provider:
        setting.embedding_provider = req.embedding_provider
    if req.top_k:
        setting.top_k = min(max(req.top_k, 1), 10)

    db.commit()
    db.refresh(setting)

    return {"message": "Settings updated successfully"}
