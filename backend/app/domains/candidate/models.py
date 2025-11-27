# app/domains/candidate/models.py

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.core.database import Base  # ✅ passt, wenn deine anderen Domains das auch so machen

class Candidate(Base):
    __tablename__ = "candidate"

    candidate_id = Column(Integer, primary_key=True, autoincrement=True)
    candidate_number = Column(String(50), unique=True, nullable=False)

    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)

    email = Column(String(255), nullable=True)
    mobile_number = Column(String(50), nullable=True)

    street = Column(String(255), nullable=True)
    street_number = Column(String(20), nullable=True)
    postcode = Column(String(20), nullable=True)
    city = Column(String(255), nullable=True)

    education_provider = Column(String(255), nullable=True)

    employer = Column(String(255), nullable=True)
    employer_street = Column(String(255), nullable=True)
    employer_street_no = Column(String(20), nullable=True)
    employer_postcode = Column(String(20), nullable=True)
    employer_city = Column(String(255), nullable=True)

    postal_box = Column(String(50), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
# End of file