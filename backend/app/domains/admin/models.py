# backend/app/domains/admin/models.py

from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base

# ✅ WICHTIG:
# User ist Owner in auth.models (einmalig!).
# Import nur, damit SQLAlchemy relationship("User") auflösen kann.
from app.domains.auth.models import User  # noqa: F401


# -------------------------------------------------------------------
# Organization Units
# -------------------------------------------------------------------

class OrganizationUnit(Base):
    __tablename__ = "organization_unit"

    org_unit_id = Column(Integer, primary_key=True, index=True)
    parent_org_unit_id = Column(
        Integer, ForeignKey("organization_unit.org_unit_id"), nullable=True
    )

    type = Column(String(50), nullable=False)  # chamber, district_chamber, ...
    name = Column(String(200), nullable=False)
    code = Column(String(20), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    parent = relationship(
        "OrganizationUnit",
        remote_side=[org_unit_id],
        back_populates="children",
        lazy="joined",
    )
    
    children = relationship(
        "OrganizationUnit",
        back_populates="parent",
        lazy="select",
    )


# -------------------------------------------------------------------
# Committees
# -------------------------------------------------------------------

class Committee(Base):
    __tablename__ = "committee"

    committee_id = Column(Integer, primary_key=True, index=True)
    org_unit_id = Column(
        Integer, ForeignKey("organization_unit.org_unit_id"), nullable=False
    )

    name = Column(String(200), nullable=False)
    description = Column(String(1000), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    org_unit = relationship("OrganizationUnit", lazy="joined")


class CommitteeFunction(Base):
    __tablename__ = "committee_function"

    committee_function_id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False, unique=True)
    display_name_de = Column(String(200), nullable=False)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class CommitteePosition(Base):
    __tablename__ = "committee_position"

    committee_position_id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False, unique=True)
    display_name_de = Column(String(200), nullable=False)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class UserCommittee(Base):
    __tablename__ = "user_committee"
    __table_args__ = (
        UniqueConstraint("user_id", "committee_id", name="uq_user_committee_user_committee"),
    )

    user_committee_id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("user.user_id"), nullable=False)
    committee_id = Column(Integer, ForeignKey("committee.committee_id"), nullable=False)

    committee_function_id = Column(
        Integer, ForeignKey("committee_function.committee_function_id"), nullable=True
    )
    committee_position_id = Column(
        Integer, ForeignKey("committee_position.committee_position_id"), nullable=True
    )

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # ✅ relationship auf auth.models.User (String-Auflösung klappt wegen Import oben)
    user = relationship("User", lazy="joined")

    committee = relationship("Committee", lazy="joined")
    committee_function = relationship("CommitteeFunction", lazy="joined")
    committee_position = relationship("CommitteePosition", lazy="joined")


# -------------------------------------------------------------------
# Time Schemes (Admin)
# -------------------------------------------------------------------

class TimeScheme(Base):
    __tablename__ = "time_scheme"

    time_scheme_id = Column(Integer, primary_key=True, index=True)

    name = Column(String(100), nullable=False)

    default_first_slot_start = Column(Time, nullable=False)
    exam_duration_minutes = Column(Integer, nullable=False)
    discussion_buffer_minutes = Column(Integer, nullable=False)
    max_slots = Column(Integer, nullable=False)

    lunch_after_slots = Column(Integer, nullable=True)
    lunch_break_duration_minutes = Column(Integer, nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class TimeSchemeDefault(Base):
    """
    Default time scheme for a given (org_unit_id, subject_id).
    Resolved by walking up organization_unit.parent_org_unit_id.
    """
    __tablename__ = "time_scheme_default"
    __table_args__ = (
        UniqueConstraint("org_unit_id", "subject_id", name="uq_time_scheme_default_org_subject"),
    )

    time_scheme_default_id = Column(Integer, primary_key=True, index=True)

    org_unit_id = Column(Integer, ForeignKey("organization_unit.org_unit_id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subject.subject_id"), nullable=False)
    time_scheme_id = Column(Integer, ForeignKey("time_scheme.time_scheme_id"), nullable=False)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    org_unit = relationship("OrganizationUnit", lazy="joined")
    time_scheme = relationship("TimeScheme", lazy="joined")
