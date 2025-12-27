# app/domains/exam/models.py

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Date,
    DECIMAL,
    ForeignKey,
    Boolean,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


# ==========================
# EXAM (zentral)
# ==========================
class Exam(Base):
    __tablename__ = "exam"

    exam_id = Column(Integer, primary_key=True, index=True)

    candidate_id = Column(Integer, ForeignKey("candidate.candidate_id"), nullable=False)
    exam_day_id = Column(Integer, ForeignKey("exam_day.exam_day_id"), nullable=False)
    exam_slot_id = Column(
        Integer,
        ForeignKey("exam_slot.exam_slot_id"),
        nullable=False,
        unique=True,
    )

    exam_day_team_id = Column(
        Integer,
        ForeignKey("exam_day_team.exam_day_team_id"),
        nullable=True,
    )
    
    exam_type = Column(String(50), nullable=False, default="aevo")
    status = Column(String(50), nullable=False, default="planned")

    final_points = Column(DECIMAL(5, 2))
    final_grade = Column(DECIMAL(3, 1))
    notes = Column(Text)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    parts = relationship(
        "ExamPart",
        back_populates="exam",
        cascade="all, delete-orphan",
        order_by="ExamPart.part_number",
    )

    protocol = relationship(
        "ExamProtocol",
        back_populates="exam",
        uselist=False,
        cascade="all, delete-orphan",
    )


# ==========================
# EXAM PARTS
# ==========================
class ExamPart(Base):
    __tablename__ = "exam_part"

    exam_part_id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exam.exam_id"), nullable=False)

    part_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    part_mode = Column(String(50), nullable=True)

    weight = Column(DECIMAL(5, 2), nullable=False, default=50.00)
    status = Column(String(50), nullable=False, default="planned")

    points = Column(Integer)
    grade = Column(DECIMAL(3, 1))
    protocol_text = Column(Text)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    exam = relationship("Exam", back_populates="parts")

    grading_sheets = relationship(
        "ExamGradingSheet",
        back_populates="exam_part",
        cascade="all, delete-orphan",
    )

    expert_discussion_items = relationship(
        "ExamExpertDiscussionItem",
        back_populates="exam_part",
        cascade="all, delete-orphan",
        order_by="ExamExpertDiscussionItem.exam_expert_discussion_item_id",
    )


# ==========================
# TEMPLATE: GRADING SHEETS
# ==========================
class GradingSheetDefinition(Base):
    __tablename__ = "grading_sheet_definition"

    grading_sheet_definition_id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subject.subject_id"), nullable=False)
    part_number = Column(Integer, nullable=False)
    variant = Column(String(50), nullable=False, default="presentation")
    version_no = Column(Integer, nullable=False, default=1)
    title = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    valid_from = Column(Date)
    valid_to = Column(Date)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    areas = relationship(
        "GradingArea",
        back_populates="sheet_definition",
        cascade="all, delete-orphan",
        order_by="GradingArea.area_number",
    )

    criteria = relationship(
        "GradingCriterionDefinition",
        back_populates="sheet_definition",
    )


# ==========================
# GRADING AREAS
# ==========================
class GradingArea(Base):
    __tablename__ = "grading_area"

    grading_area_id = Column(Integer, primary_key=True, index=True)

    grading_sheet_definition_id = Column(
        Integer,
        ForeignKey("grading_sheet_definition.grading_sheet_definition_id"),
        nullable=False,
    )

    area_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    sheet_definition = relationship(
        "GradingSheetDefinition",
        back_populates="areas",
    )

    criteria = relationship(
        "GradingCriterionDefinition",
        back_populates="area",
        cascade="all, delete-orphan",
        order_by="GradingCriterionDefinition.criterion_number",
    )


# ==========================
# GRADING CRITERIA
# ==========================
class GradingCriterionDefinition(Base):
    __tablename__ = "grading_criterion_definition"

    grading_criterion_definition_id = Column(Integer, primary_key=True, index=True)

    grading_sheet_definition_id = Column(
        Integer,
        ForeignKey("grading_sheet_definition.grading_sheet_definition_id"),
        nullable=False,
    )

    grading_area_id = Column(
        Integer,
        ForeignKey("grading_area.grading_area_id"),
        nullable=True,
    )

    criterion_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)

    weight = Column(DECIMAL(5, 2))
    max_points = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    sheet_definition = relationship(
        "GradingSheetDefinition",
        back_populates="criteria",
    )

    area = relationship(
        "GradingArea",
        back_populates="criteria",
    )

    exam_items = relationship(
        "ExamGradingItem",
        back_populates="criterion",
    )


# ==========================
# EXPERT DISCUSSION (Fachgespräch)
# ==========================
class ExpertDiscussionAreaDefinition(Base):
    __tablename__ = "expert_discussion_area_definition"

    expert_discussion_area_definition_id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subject.subject_id"), nullable=False)

    code = Column(String(50))
    title = Column(String(255), nullable=False)
    description = Column(Text)
    expected_answer = Column(Text)

    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class ExamExpertDiscussionItem(Base):
    __tablename__ = "exam_expert_discussion_item"

    exam_expert_discussion_item_id = Column(Integer, primary_key=True, index=True)

    exam_part_id = Column(
        Integer,
        ForeignKey("exam_part.exam_part_id"),
        nullable=False,
    )

    expert_discussion_area_definition_id = Column(
        Integer,
        ForeignKey("expert_discussion_area_definition.expert_discussion_area_definition_id"),
        nullable=True,
    )

    area_title = Column(String(255), nullable=False)

    candidate_statement = Column(Text)
    examiner_comment = Column(Text)

    grade = Column(DECIMAL(3, 2))
    points = Column(DECIMAL(5, 2))

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    exam_part = relationship("ExamPart", back_populates="expert_discussion_items")
    area_definition = relationship("ExpertDiscussionAreaDefinition")


# ==========================
# PRÜFER-BEWERTUNGSBOGEN
# ==========================
class ExamGradingSheet(Base):
    __tablename__ = "exam_grading_sheet"

    exam_grading_sheet_id = Column(Integer, primary_key=True, index=True)
    exam_part_id = Column(Integer, ForeignKey("exam_part.exam_part_id"), nullable=False)
    grading_sheet_definition_id = Column(
        Integer,
        ForeignKey("grading_sheet_definition.grading_sheet_definition_id"),
        nullable=False,
    )
    examiner_id = Column(Integer, ForeignKey("user.user_id"), nullable=True)

    sheet_type = Column(String(50), nullable=False, default="member")
    status = Column(String(50), nullable=False, default="draft")

    total_points = Column(Integer)
    total_grade = Column(DECIMAL(3, 1))

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    exam_part = relationship("ExamPart", back_populates="grading_sheets")
    sheet_definition = relationship("GradingSheetDefinition")
    examiner = relationship("User")

    items = relationship(
        "ExamGradingItem",
        back_populates="grading_sheet",
        cascade="all, delete-orphan",
    )


# ==========================
# GRADING ITEMS
# ==========================
class ExamGradingItem(Base):
    __tablename__ = "exam_grading_item"

    exam_grading_item_id = Column(Integer, primary_key=True, index=True)
    exam_grading_sheet_id = Column(
        Integer,
        ForeignKey("exam_grading_sheet.exam_grading_sheet_id"),
        nullable=False,
    )
    grading_criterion_definition_id = Column(
        Integer,
        ForeignKey("grading_criterion_definition.grading_criterion_definition_id"),
        nullable=False,
    )

    points = Column(Integer)
    grade = Column(DECIMAL(3, 1))
    comment = Column(Text)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    grading_sheet = relationship("ExamGradingSheet", back_populates="items")
    criterion = relationship(
        "GradingCriterionDefinition",
        back_populates="exam_items",
    )


# ==========================
# PROTOKOLL
# ==========================
class ExamProtocol(Base):
    __tablename__ = "exam_protocol"

    exam_protocol_id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(
        Integer,
        ForeignKey("exam.exam_id"),
        nullable=False,
        unique=True,
    )

    identity_checked = Column(Boolean, nullable=False, default=False)
    exam_ability_asked = Column(Boolean, nullable=False, default=False)
    bias_cleared = Column(Boolean, nullable=False, default=False)
    guest_examiner_consent = Column(Boolean, nullable=False, default=False)
    instructions_given = Column(Boolean, nullable=False, default=False)
    fraud_notice_given = Column(Boolean, nullable=False, default=False)
    devices_notice_given = Column(Boolean, nullable=False, default=False)

    precheck_comment = Column(Text, nullable=True)

    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)

    signed_by_chair = Column(Boolean, nullable=False, default=False)
    signed_by_examiner_2 = Column(Boolean, nullable=False, default=False)
    signed_by_examiner_3 = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    exam = relationship("Exam", back_populates="protocol")
# End of app/domains/exam/models.py
