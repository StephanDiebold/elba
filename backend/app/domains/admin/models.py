# app/domains/admin/models.py

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey
)
from sqlalchemy.orm import relationship
from datetime import datetime
from sqlalchemy.sql import func
from app.core.database import Base


class OrganizationUnit(Base):
    """
    Generische Organisationseinheit:
    - type: 'chamber' oder 'district_chamber'
    """
    __tablename__ = "organization_unit"

    org_unit_id = Column(Integer, primary_key=True, autoincrement=True)

    # 'chamber' | 'district_chamber'
    type = Column(String(50), nullable=False)

    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=True)

    is_active = Column(Boolean, nullable=False, server_default="1")

    parent_org_unit_id = Column(Integer, ForeignKey("organization_unit.org_unit_id"), nullable=True)
    parent_org_unit = relationship("OrganizationUnit", remote_side=[org_unit_id], backref="child_org_units")

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

class Committee(Base):
    __tablename__ = "committee"

    committee_id = Column(Integer, primary_key=True, autoincrement=True)
    org_unit_id = Column(Integer, ForeignKey("organization_unit.org_unit_id"), nullable=False)

    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    org_unit = relationship("OrganizationUnit")

class CommitteeFunction(Base):
    __tablename__ = "committee_function"

    committee_function_id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), nullable=False, unique=True)
    display_name_de = Column(String(200), nullable=False)


class CommitteePosition(Base):
    __tablename__ = "committee_position"

    committee_position_id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), nullable=False, unique=True)
    display_name_de = Column(String(200), nullable=False)


class UserCommittee(Base):
    __tablename__ = "user_committee"

    user_committee_id = Column(Integer, primary_key=True, autoincrement=True)

    user_id = Column(Integer, ForeignKey("user.user_id"), nullable=False)
    committee_id = Column(Integer, ForeignKey("committee.committee_id"), nullable=False)
    committee_function_id = Column(Integer, ForeignKey("committee_function.committee_function_id"), nullable=True)
    committee_position_id = Column(Integer, ForeignKey("committee_position.committee_position_id"), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
    committee = relationship("Committee")
    committee_function = relationship("CommitteeFunction")
    committee_position = relationship("CommitteePosition")

# End of file