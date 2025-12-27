# backend/app/domains/planner/models.py

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Date,
    Time,
    Enum,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.core.database import Base

# Wichtig: User-Model kommt aus admin.models (kein eigenes User-ORM hier!)
from app.domains.admin.models import User  # noqa: F401


# -------------------------------------------------------------------
# Core planner tables
# -------------------------------------------------------------------

class ExamDay(Base):
    __tablename__ = "exam_day"

    exam_day_id = Column(Integer, primary_key=True, index=True)

    org_unit_id = Column(Integer, ForeignKey("organization_unit.org_unit_id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subject.subject_id"), nullable=False)

    # DB NOT NULL
    time_scheme_id = Column(Integer, ForeignKey("time_scheme.time_scheme_id"), nullable=False)

    date = Column(Date, nullable=False)
    location = Column(String(255), nullable=True)
    default_room = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="planned")
    is_active = Column(Boolean, nullable=False, default=True)

    # relationships
    time_scheme = relationship("TimeScheme", lazy="joined")
    teams = relationship(
        "ExamDayTeam",
        back_populates="exam_day",
        cascade="all, delete-orphan",
    )


# -------------------------------------------------------------------
# TimeScheme + Defaults (werden in Admin-Models ebenfalls definiert!)
# WICHTIG: Damit es keinen "already defined" gibt:
# -> TimeScheme und TimeSchemeDefault NICHT in planner.models definieren.
# -> Stattdessen nur via relationship("TimeScheme") referenzieren.
# -------------------------------------------------------------------


# -------------------------------------------------------------------
# ExamDayTeam (UI label: "Ausschuss")
# -------------------------------------------------------------------

class ExamDayTeam(Base):
    __tablename__ = "exam_day_team"

    exam_day_team_id = Column(Integer, primary_key=True, index=True)
    exam_day_id = Column(Integer, ForeignKey("exam_day.exam_day_id"), nullable=False)

    name = Column(String(100), nullable=False)

    time_scheme_id = Column(Integer, ForeignKey("time_scheme.time_scheme_id"), nullable=False)

    is_active = Column(Boolean, nullable=False, default=True)

    exam_day = relationship("ExamDay", back_populates="teams")
    time_scheme = relationship("TimeScheme", lazy="joined")

    members = relationship(
        "ExamDayTeamUser",
        back_populates="team",
        cascade="all, delete-orphan",
    )

    slots = relationship(
        "ExamSlot",
        back_populates="team",
        cascade="all, delete-orphan",
    )


class ExamDayTeamUser(Base):
    __tablename__ = "exam_day_team_user"

    exam_day_team_user_id = Column(Integer, primary_key=True, index=True)
    exam_day_team_id = Column(Integer, ForeignKey("exam_day_team.exam_day_team_id"), nullable=False)
    user_id = Column(Integer, ForeignKey("user.user_id"), nullable=False)

    team = relationship("ExamDayTeam", back_populates="members")
    user = relationship("User", lazy="joined")


# -------------------------------------------------------------------
# Slots (team-based)
# -------------------------------------------------------------------

class ExamSlot(Base):
    __tablename__ = "exam_slot"

    exam_slot_id = Column(Integer, primary_key=True, index=True)

    exam_day_id = Column(Integer, ForeignKey("exam_day.exam_day_id"), nullable=False)
    exam_day_team_id = Column(Integer, ForeignKey("exam_day_team.exam_day_team_id"), nullable=False)

    slot_index = Column(Integer, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    status = Column(
        Enum("free", "reserved", "booked", "blocked", name="exam_slot_status"),
        nullable=False,
        default="free",
    )

    exam_id = Column(Integer, nullable=True)
    notes = Column(String(255), nullable=True)

    exam_day = relationship("ExamDay", lazy="joined")
    team = relationship("ExamDayTeam", back_populates="slots", lazy="joined")


# End of file
