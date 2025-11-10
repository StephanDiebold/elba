# app/models.py
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime,
    ForeignKey, Table, func 
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, text
from app.database import Base  # EIN gemeinsames Base!

# --- M:N: user_role mit Composite PK ---
user_role = Table(
    "user_role",
    Base.metadata,
    Column("user_id", ForeignKey("user.user_id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", ForeignKey("role.role_id", ondelete="CASCADE"), primary_key=True),
    Column("assigned_at", DateTime, server_default=func.current_timestamp(), nullable=False),
)

class Role(Base):
    __tablename__ = "role"
    role_id = Column(Integer, primary_key=True, autoincrement=True)
    name    = Column(String(50), unique=True, nullable=False)
    comment = Column(String(255), nullable=True)

    users = relationship("User", secondary=user_role, back_populates="roles")

class User(Base):
    __tablename__ = "user"
    user_id        = Column(Integer, primary_key=True, autoincrement=True)
    email          = Column(String(255), unique=True, nullable=False, index=True)
    password_hash  = Column(String(255), nullable=False)
    display_name   = Column(String(150), nullable=False)
    is_active      = Column(Boolean, nullable=False, server_default=text("1"))
    created_at     = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at     = Column(DateTime, nullable=True, onupdate=func.current_timestamp())
    must_change_pw = Column(Boolean, nullable=True, server_default=text("0"))

    roles = relationship("Role", secondary=user_role, back_populates="users")
