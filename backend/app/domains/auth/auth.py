# app/domains/auth/auth.py
import os
import logging
from datetime import datetime, timedelta, date

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr, constr, model_validator, field_validator
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from passlib.hash import bcrypt
from jose import jwt, JWTError

from app.core.deps import get_db
from app.core.settings import JWT_SECRET, JWT_EXPIRE_MINUTES
from app.domains.auth.models import User, Role

logger = logging.getLogger(__name__)
DEBUG = os.getenv("ELBA_DEBUG", "0") == "1"

router = APIRouter(prefix="/auth", tags=["Auth"])


# ----------------------------
# Payloads / Responses
# ----------------------------
def _split_name(full: str) -> tuple[str, str]:
    full = (full or "").strip()
    if not full:
        return "", ""
    parts = full.split(" ", 1)
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1].strip()


class RegisterPayload(BaseModel):
    email: EmailStr
    password: constr(min_length=8)
    kammer_id: int

    vorname: constr(strip_whitespace=True, min_length=1) | None = None
    nachname: constr(strip_whitespace=True, min_length=1) | None = None

    display_name: constr(strip_whitespace=True, min_length=1) | None = None
    full_name: constr(strip_whitespace=True, min_length=1) | None = None

    mobilnummer: str | None = None
    geburtstag: date | None = None
    bezirkskammer_id: int | None = None

    @field_validator("kammer_id")
    @classmethod
    def _kammer_positive(cls, v: int):
        if v is None or v <= 0:
            raise ValueError("Kammer ungültig.")
        return v

    @model_validator(mode="after")
    def _ensure_names_and_display(self):
        v = self
        dn = (v.display_name or "").strip()
        fn = (v.full_name or "").strip()

        if not v.vorname or not v.nachname:
            basis = dn or fn
            if basis:
                vor, nach = _split_name(basis)
                if not v.vorname:
                    v.vorname = vor or v.vorname
                if not v.nachname:
                    v.nachname = nach or v.nachname

        if not (v.vorname and v.nachname):
            raise ValueError("vorname und nachname oder display_name/full_name erforderlich.")

        if not dn:
            v.display_name = f"{v.vorname.strip()} {v.nachname.strip()}".strip()

        if not fn:
            v.full_name = v.display_name
        return v


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileUpdatePayload(BaseModel):
    display_name: constr(strip_whitespace=True, min_length=1) | None = None
    mobilnummer: str | None = None
    geburtstag: date | None = None

# ----------------------------
# DB helpers
# ----------------------------
def _get_or_create_role(db: Session, name: str) -> Role:
    r = db.query(Role).filter(Role.name == name).first()
    if not r:
        r = Role(name=name)
        db.add(r)
        db.flush()
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

    is_active_val = getattr(user, "is_active", 1)
    try:
        is_active_bool = bool(int(is_active_val))
    except Exception:
        is_active_bool = bool(is_active_val)

    if not is_active_bool:
        raise HTTPException(status_code=403, detail="Account noch nicht freigegeben")

    return user


# ----------------------------
# Token helper
# ----------------------------
def _create_access_token(sub: str, role: str) -> str:
    exp_minutes = int(JWT_EXPIRE_MINUTES or 60)
    exp = datetime.utcnow() + timedelta(minutes=exp_minutes)
    return jwt.encode({"sub": sub, "role": role, "exp": exp}, JWT_SECRET, algorithm="HS256")


# ----------------- Routes -----------------
@router.post("/register", status_code=201)
def register(data: RegisterPayload, db: Session = Depends(get_db)):
    norm_email = data.email.lower().strip()

    existing = db.query(User).filter(User.email == norm_email).first()
    if existing:
        if not getattr(existing, "is_active", False):
            try:
                if hasattr(existing, "display_name") and (data.display_name or "").strip():
                    existing.display_name = (data.display_name or "").strip()
                if hasattr(existing, "first_name") and (data.vorname or "").strip():
                    existing.first_name = (data.vorname or "").strip()
                if hasattr(existing, "last_name") and (data.nachname or "").strip():
                    existing.last_name = (data.nachname or "").strip()
                if hasattr(existing, "mobile_number"):
                    existing.mobile_number = data.mobilnummer
                if hasattr(existing, "birthday"):
                    existing.birthday = data.geburtstag
                if hasattr(existing, "password_hash"):
                    existing.password_hash = bcrypt.hash(data.password)
                db.flush()

                try:
                    db.execute(text("DELETE FROM user_kammer WHERE user_id = :uid"), {"uid": existing.user_id})
                    db.execute(
                        text("INSERT INTO user_kammer (user_id, kammer_id) VALUES (:uid, :kid)"),
                        {"uid": existing.user_id, "kid": data.kammer_id},
                    )
                    db.execute(text("DELETE FROM user_bezirkskammer WHERE user_id = :uid"), {"uid": existing.user_id})
                    if data.bezirkskammer_id is not None:
                        db.execute(
                            text("INSERT INTO user_bezirkskammer (user_id, bezirkskammer_id) VALUES (:uid, :bkid)"),
                            {"uid": existing.user_id, "bkid": data.bezirkskammer_id},
                        )
                except Exception as e:
                    logger.warning("Zuordnungen (update) fehlgeschlagen: %s", e)

                db.commit()
                return {
                    "user_id": existing.user_id,
                    "email": existing.email,
                    "is_active": getattr(existing, "is_active", False),
                    "updated": True,
                    "message": "Vorhandener (noch nicht freigegebener) Account aktualisiert.",
                }
            except Exception as e:
                db.rollback()
                logger.exception("Re-Registration fehlgeschlagen: %s", e)
                if DEBUG:
                    raise HTTPException(status_code=500, detail=f"DB-Fehler Re-Registration: {repr(e)}")
                raise HTTPException(status_code=500, detail="Registrierung momentan nicht möglich.")
        raise HTTPException(status_code=409, detail="E-Mail ist bereits registriert")

    # Kammer validieren
    try:
        row = db.execute(
            text("SELECT COUNT(*) AS c FROM kammer WHERE kammer_id = :kid"),
            {"kid": data.kammer_id},
        ).first()
        if not row or row.c == 0:
            raise HTTPException(status_code=422, detail="Kammer existiert nicht")

        if data.bezirkskammer_id is not None:
            row = db.execute(
                text("""
                    SELECT COUNT(*) AS c
                    FROM bezirkskammer
                    WHERE bezirkskammer_id = :bkid AND kammer_id = :kid
                """),
                {"bkid": data.bezirkskammer_id, "kid": data.kammer_id},
            ).first()
            if not row or row.c == 0:
                raise HTTPException(status_code=422, detail="Bezirkskammer gehört nicht zur gewählten Kammer")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Kammer-Validierung übersprungen: %s", e)

    try:
        display_name = (data.display_name or f"{data.vorname} {data.nachname}").strip()
        vor = (data.vorname or "").strip()
        nach = (data.nachname or "").strip()

        if not vor or not nach or not display_name:
            raise HTTPException(status_code=422, detail="Vorname, Nachname und Anzeigename sind erforderlich.")

        db.execute(
            text("""
                INSERT INTO user
                    (email, password_hash, display_name, first_name, last_name, mobile_number, birthday, is_active, must_change_password)
                VALUES
                    (:email, :pw, :display_name, :first_name, :last_name, :mobile_number, :birthday, 0, 0)
            """),
            {
                "email": norm_email,
                "pw": bcrypt.hash(data.password),
                "display_name": display_name,
                "first_name": vor,
                "last_name": nach,
                "mobile_number": data.mobilnummer,
                "birthday": data.geburtstag,
            },
        )

        new_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        db.commit()

        user = db.query(User).filter(User.user_id == int(new_id)).first()
        if not user:
            class _U: pass
            user = _U()
            user.user_id = int(new_id)
            user.email = norm_email
            user.display_name = display_name
            setattr(user, "is_active", False)

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="E-Mail ist bereits registriert")
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.exception("User-Anlage (RAW) fehlgeschlagen: %s", e)
        if DEBUG:
            raise HTTPException(status_code=500, detail=f"DB-Fehler bei der User-Anlage: {repr(e)}")
        raise HTTPException(status_code=500, detail="Registrierung momentan nicht möglich.")

    try:
        role = _get_or_create_role(db, "pruefer")
        try:
            if hasattr(user, "roles"):
                user.roles.append(role)
            else:
                db.execute(
                    text("INSERT INTO user_role (user_id, role_id) VALUES (:uid, :rid)"),
                    {"uid": user.user_id, "rid": role.role_id},
                )
        except Exception as e:
            logger.warning("Rollen-Zuordnung fehlgeschlagen: %s", e)
    except Exception as e:
        logger.warning("Rollen-Setup fehlgeschlagen: %s", e)

    try:
        db.execute(
            text("INSERT INTO user_kammer (user_id, kammer_id) VALUES (:uid, :kid)"),
            {"uid": user.user_id, "kid": data.kammer_id},
        )
        if data.bezirkskammer_id is not None:
            db.execute(
                text("INSERT INTO user_bezirkskammer (user_id, bezirkskammer_id) VALUES (:uid, :bkid)"),
                {"uid": user.user_id, "bkid": data.bezirkskammer_id},
            )
    except Exception as e:
        logger.warning("Zuordnungen (neuanlage) fehlgeschlagen: %s", e)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning("Commit nach Rollen/Kammer fehlgeschlagen: %s", e)

    return {
        "user_id": user.user_id,
        "email": user.email,
        "is_active": getattr(user, "is_active", False),
        "roles": [r.name for r in getattr(user, "roles", [])] if getattr(user, "roles", None) else ["pruefer"],
        "created": True,
    }


@router.post("/login", response_model=TokenResponse)
def login(data: LoginPayload, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if not u or not bcrypt.verify(data.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Ungültige Login-Daten")
    if not u.is_active:
        raise HTTPException(status_code=403, detail="Account noch nicht freigegeben")

    role = (u.roles[0].name if getattr(u, "roles", None) else "pruefer")
    token = _create_access_token(sub=str(u.user_id), role=role)
    return TokenResponse(access_token=token)


@router.get("/me")
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        kammer_id = db.execute(
            text("SELECT MIN(kammer_id) FROM user_kammer WHERE user_id = :uid"),
            {"uid": current_user.user_id},
        ).scalar()
        bezirkskammer_id = db.execute(
            text("SELECT MIN(bezirkskammer_id) FROM user_bezirkskammer WHERE user_id = :uid"),
            {"uid": current_user.user_id},
        ).scalar()

        return {
            "user": {
                "id": getattr(current_user, "user_id", None),
                "user_id": getattr(current_user, "user_id", None),
                "email": getattr(current_user, "email", None),
                "display_name": getattr(current_user, "display_name", None),

                # ✅ englische Namen
                "first_name": getattr(current_user, "first_name", None),
                "last_name": getattr(current_user, "last_name", None),
                "mobile_number": getattr(current_user, "mobile_number", None),
                "birthday": getattr(current_user, "birthday", None),

                # ✅ deutsche Aliase für evtl. bestehenden Frontend-Code
                "vorname": getattr(current_user, "first_name", None),
                "nachname": getattr(current_user, "last_name", None),
                "mobilnummer": getattr(current_user, "mobile_number", None),
                "geburtstag": getattr(current_user, "birthday", None),

                "roles": [
                    r.name for r in getattr(current_user, "roles", [])
                ] if getattr(current_user, "roles", None) else [],
                "kammer_id": kammer_id,
                "bezirkskammer_id": bezirkskammer_id,
            }
        }

    except Exception as e:
        logger.exception("/auth/me failed: %s", e)
        if DEBUG:
            raise HTTPException(status_code=500, detail=f"/auth/me error: {repr(e)}")
        raise HTTPException(status_code=500, detail="Profil konnte nicht geladen werden.")

@router.patch("/me")
def update_me(
    data: ProfileUpdatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        # vorbereiten der UPDATE-Teile dynamisch, nur übergebene Felder setzen
        fields = []
        params: dict[str, object] = {"uid": current_user.user_id}

        if data.display_name is not None:
            fields.append("display_name = :display_name")
            params["display_name"] = data.display_name.strip()

        if data.mobilnummer is not None:
            fields.append("mobile_number = :mobilnummer")
            params["mobilnummer"] = data.mobilnummer.strip() or None

        if data.geburtstag is not None:
            fields.append("birthday = :geburtstag")
            params["geburtstag"] = data.geburtstag

        if not fields:
            # nichts zu tun
            return {"updated": False}

        sql = "UPDATE user SET " + ", ".join(fields) + " WHERE user_id = :uid"
        db.execute(text(sql), params)
        db.commit()

        # frisch laden und dieselbe Struktur liefern wie /auth/me
        row = db.execute(
            text(
                """
                SELECT email, display_name, mobile_number, birthday
                FROM user
                WHERE user_id = :uid
                """
            ),
            {"uid": current_user.user_id},
        ).first()

        # ggf. /auth/me-Struktur wiederverwenden
        return {
            "user": {
                "user_id": current_user.user_id,
                "email": row.email if row else current_user.email,
                "display_name": row.display_name if row else getattr(current_user, "display_name", None),
                "mobilnummer": row.mobile_number if row else getattr(current_user, "mobilnummer", None),
                "geburtstag": row.birthday if row else getattr(current_user, "geburtstag", None),
                "roles": [r.name for r in getattr(current_user, "roles", [])]
                if getattr(current_user, "roles", None) else [],
            },
            "updated": True,
        }
    except Exception as e:
        logger.exception("update_me failed: %s", e)
        if DEBUG:
            raise HTTPException(status_code=500, detail=f"/auth/me PATCH error: {repr(e)}")
        raise HTTPException(status_code=500, detail="Profil konnte nicht aktualisiert werden.")
# Ende der Datei app/domains/auth/auth.py
