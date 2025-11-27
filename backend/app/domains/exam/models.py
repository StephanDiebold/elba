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

from app.db.base_class import Base


class Exam(Base):
    __tablename__ = "exam"

    exam_id = Column(Integer, primary_key=True, index=True)
    # ... deine bestehenden Felder ...

    parts = relationship("ExamPart", back_populates="exam")


class ExamPart(Base):
    __tablename__ = "exam_part"

    exam_part_id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exam.exam_id"), nullable=False)

    part_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    weight = Column(DECIMAL(5, 2), nullable=False, default=50.00)
    status = Column(String(50), nullable=False, default="planned")
    points = Column(Integer)
    grade = Column(DECIMAL(3, 1))
    protocol_text = Column(Text)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    exam = relationship("Exam", back_populates="parts")
    grading_sheets = relationship(
        "ExamGradingSheet", back_populates="exam_part", cascade="all, delete-orphan"
    )


class GradingSheetDefinition(Base):
    __tablename__ = "grading_sheet_definition"

    grading_sheet_definition_id = Column(
        Integer, primary_key=True, index=True
    )
    subject_id = Column(Integer, nullable=False)
    part_number = Column(Integer, nullable=False)
    version_no = Column(Integer, nullable=False, default=1)
    title = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    valid_from = Column(Date)
    valid_to = Column(Date)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    groups = relationship(
        "GradingCriterionGroup",
        back_populates="sheet_definition",
        cascade="all, delete-orphan",
        order_by="GradingCriterionGroup.group_number",
    )
    criteria = relationship(
        "GradingCriterionDefinition", back_populates="sheet_definition"
    )


class GradingCriterionGroup(Base):
    __tablename__ = "grading_criterion_group"

    grading_criterion_group_id = Column(
        Integer, primary_key=True, index=True
    )
    grading_sheet_definition_id = Column(
        Integer, ForeignKey("grading_sheet_definition.grading_sheet_definition_id"),
        nullable=False,
    )
    group_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    sheet_definition = relationship("GradingSheetDefinition", back_populates="groups")
    criteria = relationship(
        "GradingCriterionDefinition",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="GradingCriterionDefinition.criterion_number",
    )


class GradingCriterionDefinition(Base):
    __tablename__ = "grading_criterion_definition"

    grading_criterion_definition_id = Column(
        Integer, primary_key=True, index=True
    )
    grading_sheet_definition_id = Column(
        Integer,
        ForeignKey("grading_sheet_definition.grading_sheet_definition_id"),
        nullable=False,
    )
    grading_criterion_group_id = Column(
        Integer,
        ForeignKey("grading_criterion_group.grading_criterion_group_id"),
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
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    sheet_definition = relationship(
        "GradingSheetDefinition", back_populates="criteria"
    )
    group = relationship("GradingCriterionGroup", back_populates="criteria")
    exam_items = relationship("ExamGradingItem", back_populates="criterion")


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
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    exam_part = relationship("ExamPart", back_populates="grading_sheets")
    sheet_definition = relationship("GradingSheetDefinition")
    examiner = relationship("User")
    items = relationship(
        "ExamGradingItem",
        back_populates="grading_sheet",
        cascade="all, delete-orphan",
    )


class ExamGradingItem(Base):
    __tablename__ = "exam_grading_item"

    exam_grading_item_id = Column(Integer, primary_key=True, index=True)
    exam_grading_sheet_id = Column(
        Integer, ForeignKey("exam_grading_sheet.exam_grading_sheet_id"), nullable=False
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
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    grading_sheet = relationship("ExamGradingSheet", back_populates="items")
    criterion = relationship("GradingCriterionDefinition", back_populates="exam_items")

# End of file
