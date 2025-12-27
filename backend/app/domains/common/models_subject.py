# backend/app/domains/common/models_subject.py

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.core.database import Base


class Subject(Base):
    __tablename__ = "subject"

    subject_id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False, unique=True)
    display_name_de = Column(String(255), nullable=False)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
# End of file