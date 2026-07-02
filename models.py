import enum
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean, Enum, CheckConstraint, Float
from sqlalchemy.orm import relationship
from database import Base





class UrgencyLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class StatusType(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"



class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    password = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)

    victim_profile = relationship("Victim", back_populates="user", uselist=False)
    volunteer_profile = relationship("Volunteer", back_populates="user", uselist=False)
    operator_profile = relationship("Operator", back_populates="user", uselist=False)



class Victim(Base):
    __tablename__ = "victim"
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    user = relationship("User", back_populates="victim_profile")
    requests = relationship("AidRequest", back_populates="victim")


class Volunteer(Base):
    __tablename__ = "volunteer"
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    user = relationship("User", back_populates="volunteer_profile")
    resources = relationship("Resource", back_populates="volunteer")


class Operator(Base):
    __tablename__ = "operator"
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    user = relationship("User", back_populates="operator_profile")

class OperatorCode(Base):
    __tablename__ = "operator_codes"

    code = Column(String(50), primary_key=True) # Üretilen kod (Örn: "OP-9821")
    is_used = Column(Boolean, default=False)     # Kullanıldı mı?



class AidRequest(Base):
    __tablename__ = "aid_request"

    request_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("victim.user_id", ondelete="CASCADE"), nullable=False)
    zone = Column(String(100), nullable=False)
    description = Column(Text)

    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)


    category = Column(String(100), nullable=False)
    urgency = Column(Enum(UrgencyLevel), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)

    victim = relationship("Victim", back_populates="requests")
    assignments = relationship("Assigned", back_populates="request")

    __table_args__ = (CheckConstraint('quantity >= 0', name='check_quantity_positive'),)



class Resource(Base):
    __tablename__ = "resource"

    resource_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("volunteer.user_id", ondelete="CASCADE"), nullable=False)
    category = Column(String(100), nullable=False)
    quantity = Column(Integer, nullable=False)
    zone = Column(String(100), nullable=False)
    description = Column(Text)

    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)

    availability = Column(Boolean, default=True, nullable=False)

 

    volunteer = relationship("Volunteer", back_populates="resources")
    assignments = relationship("Assigned", back_populates="resource")

    __table_args__ = (CheckConstraint('quantity >= 0', name='check_resource_quantity_non_negative'),)



class Assigned(Base):
    __tablename__ = "assigned"

    assignment_id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(Integer, ForeignKey("resource.resource_id", ondelete="CASCADE"), nullable=False)
    request_id = Column(Integer, ForeignKey("aid_request.request_id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False)
    status = Column(Enum(StatusType), default=StatusType.pending, nullable=False)

    resource = relationship("Resource", back_populates="assignments")
    request = relationship("AidRequest", back_populates="assignments")

    __table_args__ = (CheckConstraint('quantity > 0', name='check_assigned_quantity_positive'),)