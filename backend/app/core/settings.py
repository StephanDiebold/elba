# backend/app/settings.py
import os
from typing import List

def split_env_list(val: str | None) -> List[str]:
    return [x.strip() for x in (val or "").split(",") if x.strip()]

ENV = os.getenv("ENV", "dev")  # dev|prod

# --- CORS ---
ALLOW_ORIGINS: List[str] = split_env_list(os.getenv("ALLOW_ORIGINS"))
ALLOW_ORIGIN_REGEX: str = os.getenv("ALLOW_ORIGIN_REGEX", "")

# --- DB & Auth ---
DATABASE_URL: str = os.getenv("DATABASE_URL", "mysql+pymysql://elba:elba@mariadb:3306/elba")
JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me")
JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
