import uuid
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.config import ACCESS_TOKEN_EXPIRE_MINUTES
from app.database import get_db, User, UserSetting
from app.auth.utils import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# Schemas
class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    username_or_email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    # Check if username or email exists
    existing_user = db.query(User).filter(
        (User.username == req.username) | (User.email == req.email)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email is already registered",
        )

    if len(req.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long",
        )

    hashed = hash_password(req.password)
    user = User(
        username=req.username.strip(),
        email=req.email.lower().strip(),
        hashed_password=hashed,
        full_name=req.full_name,
        is_guest=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Initialize default user settings
    settings = UserSetting(user_id=user.id)
    db.add(settings)
    db.commit()

    # Generate token
    token = create_access_token(data={"sub": user.username, "user_id": user.id})
    response.set_cookie(
        key="access_token",
        value=f"Bearer {token}",
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_guest": False,
        },
    }


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    query = req.username_or_email.strip()
    user = db.query(User).filter(
        (User.username == query) | (User.email == query.lower())
    ).first()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify username and password.",
        )

    token = create_access_token(data={"sub": user.username, "user_id": user.id})
    response.set_cookie(
        key="access_token",
        value=f"Bearer {token}",
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name or user.username,
            "is_guest": user.is_guest,
        },
    }


@router.post("/guest", response_model=AuthResponse)
def guest_login(response: Response, db: Session = Depends(get_db)):
    """One-click instant login for employers and reviewers."""
    uid = uuid.uuid4().hex[:6]
    guest_username = f"guest_evaluator_{uid}"
    guest_email = f"{guest_username}@demo.enterprise.io"
    dummy_pass = hash_password(uuid.uuid4().hex)

    user = User(
        username=guest_username,
        email=guest_email,
        hashed_password=dummy_pass,
        full_name="Guest Evaluator",
        is_guest=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Initialize default settings
    settings = UserSetting(user_id=user.id)
    db.add(settings)
    db.commit()

    # Pre-seed demo documents so the user can immediately chat without any friction
    try:
        from app.routes.documents import load_sample_documents
        load_sample_documents(user=user, db=db)
    except Exception as e:
        print(f"[Warning] Could not auto-seed sample docs: {e}")

    token = create_access_token(data={"sub": user.username, "user_id": user.id})
    response.set_cookie(
        key="access_token",
        value=f"Bearer {token}",
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_guest": True,
        },
    }


@router.get("/me")
def get_current_user_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Count user documents & conversations
    doc_count = len(user.documents)
    conv_count = len(user.conversations)

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name or user.username,
        "is_guest": user.is_guest,
        "stats": {
            "documents_indexed": doc_count,
            "conversations_count": conv_count,
        },
    }


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Successfully logged out"}
