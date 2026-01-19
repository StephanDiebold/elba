# app/domains/exam/models.py

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    DECIMAL,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


# ==========================
# EXAM (zentral)
# ==========================
class Exam(Base):
    __tablename__ = "exam"

    exam_id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subject.subject_id"), nullable=True, index=True)

    candidate_id = Column(Integer, ForeignKey("candidate.candidate_id"), nullable=False)
    exam_day_id = Column(Integer, ForeignKey("exam_day.exam_day_id"), nullable=False)
    exam_slot_id = Column(Integer, ForeignKey("exam_slot.exam_slot_id"), nullable=False, unique=True)

    exam_day_team_id = Column(Integer, ForeignKey("exam_day_team.exam_day_team_id"), nullable=True)

    exam_type = Column(
        SAEnum("aevo", "wfw", "it", "custom", name="exam_type_enum"),
        nullable=False,
        default="aevo",
    )

    status = Column(
        SAEnum("planned", "in_progress", "done", "canceled", "no_show", name="exam_status_enum"),
        nullable=False,
        default="planned",
    )

    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)

    attendance_status = Column(
        SAEnum("present", "no_show_excused", "no_show_unexcused", name="attendance_status_enum"),
        nullable=True,
    )

    final_points = Column(DECIMAL(5, 2))
    final_grade = Column(DECIMAL(3, 1))
    notes = Column(Text)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

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

    checkin = relationship(
        "ExamCheckin",
        back_populates="exam",
        uselist=False,
        cascade="all, delete-orphan",
    )


# ==========================
# CHECK-IN (separat, MVP)
# ==========================
class ExamCheckin(Base):
    __tablename__ = "exam_checkin"

    exam_id = Column(Integer, ForeignKey("exam.exam_id"), primary_key=True)

    identity_checked = Column(Boolean, nullable=False, default=False)
    fit_for_exam_confirmed = Column(Boolean, nullable=False, default=False)
    conflict_of_interest_cleared = Column(Boolean, nullable=False, default=False)
    procedure_info_given = Column(Boolean, nullable=False, default=False)
    phone_notice_given = Column(Boolean, nullable=False, default=False)

    guest_observer_consent = Column(Boolean, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    exam = relationship("Exam", back_populates="checkin", uselist=False)


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

    points = Column(DECIMAL(6, 2))
    grade = Column(DECIMAL(3, 1))
    protocol_text = Column(Text)

    # Teil 2 Ergebnisfelder (Fachgespräch)
    expert_discussion_points_100 = Column(DECIMAL(6, 2), nullable=True)
    expert_discussion_grade = Column(DECIMAL(3, 1), nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    exam = relationship("Exam", back_populates="parts")

    grading_sheets = relationship(
        "ExamGradingSheet",
        back_populates="exam_part",
        cascade="all, delete-orphan",
    )

    # Teil 2 (V2-final): Areas hängen direkt am Part
    expert_discussion_areas = relationship(
        "ExamExpertDiscussionArea",
        back_populates="exam_part",
        cascade="all, delete-orphan",
        order_by="ExamExpertDiscussionArea.exam_expert_discussion_area_id",
    )


# ==========================
# EXPERT DISCUSSION (Teil 2) - Templates
# ==========================
class ExpertDiscussionArea(Base):
    __tablename__ = "expert_discussion_area"

    area_id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subject.subject_id"), nullable=False, index=True)

    code = Column(String(50), nullable=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    expected_answer = Column(Text, nullable=True)

    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship(
        "ExpertDiscussionItem",
        back_populates="area",
        cascade="all, delete-orphan",
        order_by="ExpertDiscussionItem.sort_order",
    )


class ExpertDiscussionItem(Base):
    __tablename__ = "expert_discussion_item"

    item_id = Column(Integer, primary_key=True, index=True)
    area_id = Column(Integer, ForeignKey("expert_discussion_area.area_id"), nullable=False, index=True)

    item_text = Column(String(500), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    area = relationship("ExpertDiscussionArea", back_populates="items")


# ==========================
# EXPERT DISCUSSION (Teil 2) - Exam Instances
# ==========================
class ExamExpertDiscussionArea(Base):
    __tablename__ = "exam_expert_discussion_area"
    __table_args__ = (
        UniqueConstraint("exam_part_id", "expert_discussion_area_id", name="uq_exam_part_area"),
    )

    exam_expert_discussion_area_id = Column(Integer, primary_key=True, index=True)

    exam_part_id = Column(Integer, ForeignKey("exam_part.exam_part_id"), nullable=False, index=True)
    expert_discussion_area_id = Column(
        Integer, ForeignKey("expert_discussion_area.area_id"), nullable=False, index=True
    )

    area_title = Column(String(255), nullable=False)

    points_100 = Column(DECIMAL(5, 2), nullable=True)
    grade = Column(DECIMAL(3, 1), nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    exam_part = relationship("ExamPart", back_populates="expert_discussion_areas")
    template_area = relationship("ExpertDiscussionArea")

    items = relationship(
        "ExamExpertDiscussionItem",
        back_populates="area",
        cascade="all, delete-orphan",
        order_by="ExamExpertDiscussionItem.sort_order",
    )


class ExamExpertDiscussionItem(Base):
    __tablename__ = "exam_expert_discussion_item"

    exam_expert_discussion_item_id = Column(Integer, primary_key=True, index=True)

    exam_expert_discussion_area_id = Column(
        Integer,
        ForeignKey("exam_expert_discussion_area.exam_expert_discussion_area_id"),
        nullable=False,
        index=True,
    )

    template_item_id = Column(
        Integer,
        ForeignKey("expert_discussion_item.item_id"),
        nullable=True,
        index=True,
    )

    question_text = Column(String(500), nullable=False)
    answer_text = Column(Text, nullable=True)
    examiner_comment = Column(Text, nullable=True)

    sort_order = Column(Integer, nullable=False, default=1)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    area = relationship("ExamExpertDiscussionArea", back_populates="items")
    template_item = relationship("ExpertDiscussionItem")


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
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

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
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    sheet_definition = relationship("GradingSheetDefinition", back_populates="areas")

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

    grading_area_id = Column(Integer, ForeignKey("grading_area.grading_area_id"), nullable=True)

    criterion_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)

    weight = Column(DECIMAL(5, 2))
    max_points = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    sheet_definition = relationship("GradingSheetDefinition", back_populates="criteria")
    area = relationship("GradingArea", back_populates="criteria")

    exam_items = relationship("ExamGradingItem", back_populates="criterion")


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

    total_points = Column(DECIMAL(6, 2))
    total_grade = Column(DECIMAL(3, 1))

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

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

    points = Column(DECIMAL(6, 2))
    grade = Column(DECIMAL(3, 1))
    comment = Column(Text)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    grading_sheet = relationship("ExamGradingSheet", back_populates="items")
    criterion = relationship("GradingCriterionDefinition", back_populates="exam_items")


# ==========================
# PROTOKOLL
# ==========================
class ExamProtocol(Base):
    __tablename__ = "exam_protocol"

    exam_protocol_id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exam.exam_id"), nullable=False, unique=True)

    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)

    signed_by_chair = Column(Boolean, nullable=False, default=False)
    signed_by_examiner_2 = Column(Boolean, nullable=False, default=False)
    signed_by_examiner_3 = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    exam = relationship("Exam", back_populates="protocol")


# ==========================
# IHK NOTENSCHLÜSSEL (GRADE KEY)
# ==========================
class GradeKeyVersion(Base):
    __tablename__ = "grade_key_version"

    grade_key_version_id = Column(Integer, primary_key=True, index=True)

    subject_id = Column(Integer, ForeignKey("subject.subject_id"), nullable=False)

    version_no = Column(Integer, nullable=False, default=1)
    valid_from = Column(Date, nullable=False)
    valid_to = Column(Date, nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    entries = relationship(
        "GradeKeyEntry",
        back_populates="version",
        cascade="all, delete-orphan",
        order_by="GradeKeyEntry.points_100.desc()",
    )


class GradeKeyEntry(Base):
    __tablename__ = "grade_key_entry"

    grade_key_entry_id = Column(Integer, primary_key=True, index=True)

    grade_key_version_id = Column(Integer, ForeignKey("grade_key_version.grade_key_version_id"), nullable=False)

    points_100 = Column(Integer, nullable=False)
    grade_decimal = Column(DECIMAL(3, 1), nullable=False)

    grade_letter = Column(String(1), nullable=True)
    grade_text = Column(String(50), nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    version = relationship("GradeKeyVersion", back_populates="entries")
# End domain/exam/models.py