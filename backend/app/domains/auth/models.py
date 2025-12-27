# app/domains/auth/models.py
from sqlalchemy import Column, Integer, String, Boolean, Date, Table, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

user_role = Table(
    "user_role",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("user.user_id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("role.role_id"), primary_key=True),
)


class User(Base):
    __tablename__ = "user"

    user_id = Column(Integer, primary_key=True, autoincrement=True)

    identifier = Column(String(50), unique=True)
    email = Column(String(255), nullable=False, unique=True)
    username = Column(String(100))
    password_hash = Column(String(255), nullable=False)

    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    mobile_number = Column(String(50))
    birthday = Column(Date)

    display_name = Column(String(150))
    locale = Column(String(10))
    time_zone = Column(String(50))

    is_active = Column(Boolean, default=True)
    must_change_password = Column(Boolean, default=False)

    roles = relationship(
        "Role",
        secondary=user_role,
        back_populates="users",
        lazy="joined",
    )


class Role(Base):
    __tablename__ = "role"

    role_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)

    users = relationship(
        "User",
        secondary=user_role,
        back_populates="roles",
    )
# End of app/domains/auth/models.py