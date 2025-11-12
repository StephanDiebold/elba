# app/domains/auth/models.py
from sqlalchemy import Column, Integer, String, Boolean, Date, Table, ForeignKey
from sqlalchemy.orm import relationship, declarative_base
from app.core.database import Base

# Assoziationstabelle (Name wie in deiner DB)
user_role = Table(
    "user_role",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("user.user_id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("role.role_id"), primary_key=True),
)

class User(Base):
    __tablename__ = "user"
    user_id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(255))
    vorname = Column(String(100))
    nachname = Column(String(100))
    mobilnummer = Column(String(50))
    geburtstag = Column(Date)
    is_active = Column(Boolean, default=False)
    must_change_pw = Column(Boolean, default=False)

    # optional; dein Code nutzt u.roles[0].name
    roles = relationship("Role", secondary=user_role, back_populates="users", lazy="joined")

class Role(Base):
    __tablename__ = "role"
    role_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)

    users = relationship("User", secondary=user_role, back_populates="roles")
