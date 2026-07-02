from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, func
import database
import models
import schemas
import auth_utils
from database import engine, get_db
from fastapi.middleware.cors import CORSMiddleware
from schemas import AssignedCreate, AssignedResponse

app = FastAPI(title="PNo2: Disaster Coordination System")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=engine)

@app.post("/requests/", response_model=schemas.AidRequestResponse)
def create_aid_request(request: schemas.AidRequestCreate, db: Session = Depends(get_db)):

    new_request = models.AidRequest(**request.model_dump())


    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    return new_request

@app.get("/requests/", response_model=list[schemas.AidRequestResponse])
def get_all_requests(db: Session = Depends(get_db)):

    requests = db.query(models.AidRequest).all()
    return requests


@app.post("/resources/", response_model=schemas.ResourceResponse)
def create_resource(resource: schemas.ResourceCreate, db: Session = Depends(get_db)):
    new_resource = models.Resource(**resource.model_dump())
    db.add(new_resource)
    db.commit()
    db.refresh(new_resource)
    return new_resource


@app.get("/resources/", response_model=list[schemas.ResourceResponse])
def get_all_resources(db: Session = Depends(get_db)):
    return db.query(models.Resource).all()



@app.post("/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if user.role == "operator":
        db_code = db.query(models.OperatorCode).filter(
            models.OperatorCode.code == user.operator_key,
            models.OperatorCode.is_used == False
        ).first()

        if not db_code:
            raise HTTPException(
                status_code=403,
                detail="Geçersiz veya daha önce kullanılmış operatör kodu!"
            )
        db_code.is_used = True

    hashed_pwd = auth_utils.get_password_hash(user.password)

    new_user = models.User(name=user.name, password=hashed_pwd)
    db.add(new_user)
    db.flush()

    if user.role == "victim":
        role_entry = models.Victim(user_id=new_user.user_id)
        print(f"Victim olusturuluyor, user_id: {new_user.user_id}")
    elif user.role == "volunteer":
        role_entry = models.Volunteer(user_id=new_user.user_id)
    elif user.role == "operator":
        role_entry = models.Operator(user_id=new_user.user_id)
    else:
        raise HTTPException(status_code=400, detail="Geçersiz rol")

    db.add(role_entry)
    db.commit()
    print("Commit tamam")
    db.refresh(new_user)

    return new_user


@app.post("/login")
def login(username: str, password: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.name == username).first()

    if not user or not auth_utils.verify_password(password, user.password):
        raise HTTPException(status_code=400, detail="Hatalı kullanıcı adı veya şifre")

    role = None
    if db.query(models.Victim).filter(models.Victim.user_id == user.user_id).first():
        role = "victim"
    elif db.query(models.Volunteer).filter(models.Volunteer.user_id == user.user_id).first():
        role = "volunteer"
    elif db.query(models.Operator).filter(models.Operator.user_id == user.user_id).first():
        role = "operator"

    return {"message": "Giriş başarılı", "user_id": user.user_id, "role": role, "name": user.name}


@app.post("/assignments/", response_model=schemas.AssignedResponse)
def create_assignment(assignment: schemas.AssignedCreate, db: Session = Depends(get_db)):
    resource = db.query(models.Resource).filter(models.Resource.resource_id == assignment.resource_id).first()
    request  = db.query(models.AidRequest).filter(models.AidRequest.request_id == assignment.request_id).first()

    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")
    if not request:
        raise HTTPException(status_code=404, detail="Aid request not found.")

    if resource.category != request.category:
        raise HTTPException(
            status_code=400,
            detail=f"Category mismatch: resource is '{resource.category}' but request needs '{request.category}'."
        )

    if assignment.quantity > resource.quantity:
        raise HTTPException(status_code=400, detail=f"Not enough resource quantity. Available: {resource.quantity}")
    if assignment.quantity > request.quantity:
        raise HTTPException(status_code=400, detail=f"Assigned quantity exceeds request need. Needed: {request.quantity}")

    resource.quantity -= assignment.quantity
    if resource.quantity == 0:
        resource.availability = False

    request.quantity -= assignment.quantity


    new = models.Assigned(**assignment.model_dump())
    db.add(new)
    db.commit()
    db.refresh(new)
    return new

@app.get("/assignments/", response_model=list[schemas.AssignedResponse])
def get_all_assignments(db: Session = Depends(get_db)):
    return db.query(models.Assigned).all()

@app.patch("/assignments/{assignment_id}", response_model=schemas.AssignedResponse)
def update_assignment_status(assignment_id: int, update: schemas.AssignedStatusUpdate, db: Session = Depends(get_db)):
    assignment = db.query(models.Assigned).filter(
        models.Assigned.assignment_id == assignment_id
    ).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    if update.status == "cancelled":
        if assignment.status == "cancelled":
            raise HTTPException(status_code=400, detail="Assignment is already cancelled.")
        if assignment.status == "completed":
            raise HTTPException(status_code=400, detail="Cannot cancel a completed assignment.")

        resource = db.query(models.Resource).filter(models.Resource.resource_id == assignment.resource_id).first()
        request  = db.query(models.AidRequest).filter(models.AidRequest.request_id == assignment.request_id).first()
        if resource:
            resource.quantity += assignment.quantity
            resource.availability = True
        if request:
            request.quantity += assignment.quantity

    assignment.status = update.status
    db.commit()
    db.refresh(assignment)
    return assignment

@app.get("/volunteers/ranking")
def get_volunteer_ranking(db: Session = Depends(get_db)):
    query = (
        db.query(
            models.User.name,
            models.User.user_id,
            func.count(models.Assigned.resource_id).label("completed_count")
        )
        .select_from(models.Volunteer)
        .join(models.User, models.Volunteer.user_id == models.User.user_id)
        .outerjoin(models.Resource, models.Volunteer.user_id == models.Resource.user_id)
        .outerjoin(
            models.Assigned, 
            (models.Resource.resource_id == models.Assigned.resource_id) & (models.Assigned.status == "completed")
        )
        .group_by(models.User.user_id, models.User.name)
        .order_by(func.count(models.Assigned.resource_id).desc())
        .all()
    )
    
    return [
        {"user_id": row.user_id, "name": row.name, "completed_count": row.completed_count}
        for row in query
    ]