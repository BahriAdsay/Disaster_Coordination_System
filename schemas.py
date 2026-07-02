from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum



class UrgencyLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class StatusType(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class AidRequestBase(BaseModel):
    zone: str
    description: Optional[str] = None
    lat: float
    lng: float
    category: str
    urgency: UrgencyLevel
    quantity: int = Field(default=1, ge=0)


class AidRequestCreate(AidRequestBase):
    user_id: int


class AidRequestResponse(AidRequestBase):
    request_id: int
    user_id: int
    status: Optional[StatusType] = StatusType.pending

    class Config:
        from_attributes = True


class ResourceBase(BaseModel):
    category: str
    quantity: int = Field(gt=-1)
    zone: str
    description: Optional[str] = None
    lat: float
    lng: float
    availability: bool = True



class ResourceCreate(ResourceBase):
    user_id: int


class ResourceResponse(ResourceBase):
    resource_id: int
    user_id: int

    class Config:
        from_attributes = True



class UserCreate(BaseModel):
    name: str
    password: str
    role: str  # victim, volunteer, operators
    operator_key: Optional[str] = None


class UserResponse(BaseModel):
    user_id: int
    name: str

    class Config:
        from_attributes = True


class AssignedCreate(BaseModel):
    resource_id: int
    request_id: int
    quantity: int
    status: StatusType = StatusType.pending

class AssignedResponse(BaseModel):
    assignment_id: int
    resource_id: int
    request_id: int
    quantity: int
    status: StatusType

    class Config:
        from_attributes = True

class AssignedStatusUpdate(BaseModel):
    status: StatusType

