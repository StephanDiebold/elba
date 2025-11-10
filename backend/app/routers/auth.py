# app/routes/auth.py (oder wo deine Datei liegt)
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from passlib.hash import bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta

from app.database import SessionLocal
from app.settings import JWT_SECRET, JWT_EXPIRE_MINUTES
from app.models import User, Role

# >>> Prefix & Tag setzen (sichtbar in /openapi.json)
router = APIRouter(prefix="/auth", tags=["Auth"])

class RegisterPayload(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    full_name: str | None = None

class LoginPayload(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _get_or_create_role(db: Session, name: str) -> Role:
    r = db.query(Role).filter(Role.name == name).first()
    if not r:
        r = Role(name=name)
        db.add(r); db.commit(); db.refresh(r)
    return r

# ---------- Helpers für JWT / Current User ----------

def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1]:
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    return parts[1]

def get_current_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> User:
    token = _extract_bearer_token(authorization)
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing subject")

    user = db.query(User).filter(User.user_id == int(sub)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account noch nicht freigegeben")
    return user

# ----------------- Routes -----------------

@router.post("/register")
def register(data: RegisterPayload, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-Mail existiert bereits")

    user = User(
        email=data.email,
        password_hash=bcrypt.hash(data.password),
        display_name=data.display_name,
        is_active=False,
        must_change_pw=False,
    )
    r = _get_or_create_role(db, "pruefer")
    user.roles.append(r)

    db.add(user); db.commit(); db.refresh(user)
    return {"user_id": user.user_id, "email": user.email, "is_active": user.is_active}

@router.post("/login", response_model=TokenResponse)
def login(data: LoginPayload, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == data.email).first()
    if not u or not bcrypt.verify(data.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Ungültige Login-Daten")
    if not u.is_active:
        raise HTTPException(status_code=403, detail="Account noch nicht freigegeben")

    role = (u.roles[0].name if u.roles else "pruefer")
    exp = datetime.utcnow() + timedelta(minutes=int(JWT_EXPIRE_MINUTES or 60))
    token = jwt.encode({"sub": str(u.user_id), "role": role, "exp": exp}, JWT_SECRET, algorithm="HS256")
    return TokenResponse(access_token=token)

@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    # Liefere genau das, was dein Frontend-Normalizer erwartet
    return {
        "user": {
            "id": current_user.user_id,     # du nutzt sowohl id als auch user_id
            "user_id": current_user.user_id,
            "email": current_user.email,
            "display_name": current_user.display_name,
            "roles": [r.name for r in current_user.roles] if current_user.roles else [],
        }
    }
