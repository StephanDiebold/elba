# app/routes/auth.py
import os
DEBUG = os.getenv("ELBA_DEBUG", "0") == "1"

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr, constr, model_validator, field_validator
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from passlib.hash import bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta, date
import logging

from app.database import SessionLocal
from app.settings import JWT_SECRET, JWT_EXPIRE_MINUTES
from app.models import User, Role  # erwartet: Relationship user.roles (optional)

logger = logging.getLogger(__name__)

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


# ----------------------------
# DB helpers
# ----------------------------
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

    # is_active kann im ORM fehlen → getattr mit Default 1 (=aktiv)
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

    # A) E-Mail bereits vorhanden?
    existing = db.query(User).filter(User.email == norm_email).first()
    if existing:
        if not getattr(existing, "is_active", False):
            try:
                # sichere Strings
                if hasattr(existing, "display_name") and (data.display_name or "").strip():
                    existing.display_name = (data.display_name or "").strip()
                if hasattr(existing, "vorname") and (data.vorname or "").strip():
                    existing.vorname = (data.vorname or "").strip()
                if hasattr(existing, "nachname") and (data.nachname or "").strip():
                    existing.nachname = (data.nachname or "").strip()
                if hasattr(existing, "mobilnummer"):
                    existing.mobilnummer = data.mobilnummer
                if hasattr(existing, "geburtstag"):
                    existing.geburtstag = data.geburtstag
                if hasattr(existing, "password_hash"):
                    existing.password_hash = bcrypt.hash(data.password)
                db.flush()

                # Kammer/Bezirkskammer upsert – getrennte Tabellen!
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

    # B) Kammer/Bezirkskammer validieren
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

    # C) User anlegen & COMMIT  (RAW-SQL, passend zu deiner Tabelle)
    try:
        display_name = (data.display_name or f"{data.vorname} {data.nachname}").strip()
        vor = (data.vorname or "").strip()
        nach = (data.nachname or "").strip()

        # HARTE Validierung gegen DB-Constraints (deine Tabelle hat NOT NULL für vorname/nachname/display_name)
        if not vor or not nach or not display_name:
            raise HTTPException(status_code=422, detail="Vorname, Nachname und Anzeigename sind erforderlich.")

        # Insert exakt in die vorhandenen Spaltennamen
        db.execute(
            text("""
                INSERT INTO user
                    (email, password_hash, display_name, vorname, nachname, mobilnummer, geburtstag, is_active, must_change_pw)
                VALUES
                    (:email, :pw, :display_name, :vorname, :nachname, :mobilnummer, :geburtstag, 0, 0)
            """),
            {
                "email": norm_email,
                "pw": bcrypt.hash(data.password),
                "display_name": display_name,
                "vorname": vor,
                "nachname": nach,
                "mobilnummer": data.mobilnummer,
                "geburtstag": data.geburtstag,
            },
        )

        # Neue ID holen und "user" wieder laden (damit unten Rollen/Zuordnungen funktionieren)
        new_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        db.commit()

        # Falls dein ORM-Model von Tabellenspalten abweicht, klappt das Laden evtl. nicht
        # -> wir versuchen es, fallen aber notfalls auf ein Dict-Objekt zurück.
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
        # echte UNIQUE(email)-Kollision
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

    # D) Rolle & Zuordnungen nachgelagert (soft-fail)
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
        # user_kammer: nur (user_id, kammer_id)
        db.execute(
            text("INSERT INTO user_kammer (user_id, kammer_id) VALUES (:uid, :kid)"),
            {"uid": user.user_id, "kid": data.kammer_id},
        )
        # user_bezirkskammer separat
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
        # kammer_id robust ermitteln (ohne Order-by auf unbekannter PK)
        kammer_id = db.execute(
            text("SELECT MIN(kammer_id) FROM user_kammer WHERE user_id = :uid"),
            {"uid": current_user.user_id},
        ).scalar()

        # bezirkskammer_id separat
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
                "vorname": getattr(current_user, "vorname", None),
                "nachname": getattr(current_user, "nachname", None),
                "mobilnummer": getattr(current_user, "mobilnummer", None),
                "geburtstag": getattr(current_user, "geburtstag", None),
                "roles": [r.name for r in getattr(current_user, "roles", [])]
                         if getattr(current_user, "roles", None) else [],
                "kammer_id": kammer_id,
                "bezirkskammer_id": bezirkskammer_id,
            }
        }
    except Exception as e:
        logger.exception("/auth/me failed: %s", e)
        if DEBUG:
            raise HTTPException(status_code=500, detail=f"/auth/me error: {repr(e)}")
        raise HTTPException(status_code=500, detail="Profil konnte nicht geladen werden.")
