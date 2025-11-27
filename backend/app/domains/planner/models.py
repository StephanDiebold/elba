# app/domains/planner/models.py

from datetime import date, time as dtime
from sqlalchemy import Column, Integer, String, Boolean, Date, Time, Enum, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base

class ExamDay(Base):
    __tablename__ = "exam_day"

    exam_day_id = Column(Integer, primary_key=True, index=True)
    org_unit_id = Column(Integer, nullable=False)
    subject_id = Column(Integer, nullable=False)
    time_scheme_id = Column(Integer, nullable=False)
    date = Column(Date, nullable=False)
    location = Column(String(255), nullable=True)
    default_room = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="planned")
    is_active = Column(Boolean, nullable=False, default=True)


# Die weiteren Tabellen legen wir schon minimal an, damit wir sie später nutzen können

class TimeScheme(Base):
    __tablename__ = "time_scheme"

    time_scheme_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    default_first_slot_start = Column(Time, nullable=False)
    exam_duration_minutes = Column(Integer, nullable=False)
    discussion_buffer_minutes = Column(Integer, nullable=False)
    max_slots = Column(Integer, nullable=False)


class ExamDayCommittee(Base):
    __tablename__ = "exam_day_committee"

    exam_day_committee_id = Column(Integer, primary_key=True, index=True)
    exam_day_id = Column(Integer, ForeignKey("exam_day.exam_day_id"), nullable=False)
    committee_id = Column(Integer, nullable=False)
    room = Column(String(100), nullable=True)
    location = Column(String(255), nullable=True)
    time_scheme_id = Column(Integer, nullable=True)


class ExamSlot(Base):
    __tablename__ = "exam_slot"

    exam_slot_id = Column(Integer, primary_key=True, index=True)
    exam_day_id = Column(Integer, ForeignKey("exam_day.exam_day_id"), nullable=False)
    committee_id = Column(Integer, nullable=False)
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


class Exam(Base):
    __tablename__ = "exam"

    exam_id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, nullable=False)
    exam_day_id = Column(Integer, ForeignKey("exam_day.exam_day_id"), nullable=False)
    exam_slot_id = Column(Integer, nullable=False)
    committee_id = Column(Integer, nullable=False)
    exam_type = Column(
        Enum("aevo", "wfw", "it", "custom", name="exam_type"),
        nullable=False,
        default="aevo",
    )
    status = Column(
        Enum("planned", "in_progress", "done", "canceled", "no_show", name="exam_status"),
        nullable=False,
        default="planned",
    )
# End of backend/app/domains/planner/models.py