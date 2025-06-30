import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
import uuid

from app.core.database import Base
from app.models import Employee, Restaurant
from app.schemas.employee import EmployeeCreate, EmployeeUpdate
from app.services import employee_service

# Use an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Seed initial data if necessary for all tests in this module
        # For example, a common restaurant
        global test_restaurant_id # Make it accessible to tests
        test_restaurant_id = uuid.uuid4()
        restaurant = Restaurant(id=test_restaurant_id, name="Service Test Restaurant", address={"city": "TestCity"})
        db.add(restaurant)
        db.commit()
        db.refresh(restaurant)
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_create_employee_service(db_session: Session):
    employee_create_data = EmployeeCreate(
        name="Service User",
        role="Service Role",
        restaurant_id=test_restaurant_id, # Use the globally defined test_restaurant_id
        hourly_rate=25.0,
        status="pending"
    )
    employee = employee_service.create_employee(db_session, employee_create_data)

    assert employee.id is not None
    assert employee.name == "Service User"
    assert employee.restaurant_id == test_restaurant_id
    assert employee.status == "pending"

    retrieved_employee = db_session.query(Employee).filter(Employee.id == employee.id).first()
    assert retrieved_employee is not None
    assert retrieved_employee.name == "Service User"

def test_get_employee_service(db_session: Session):
    employee_create_data = EmployeeCreate(
        name="Get Me User",
        role="Getter",
        restaurant_id=test_restaurant_id,
        hourly_rate=30.0,
        status="active"
    )
    created_employee = employee_service.create_employee(db_session, employee_create_data)

    retrieved_employee = employee_service.get_employee(db_session, created_employee.id)
    assert retrieved_employee is not None
    assert retrieved_employee.id == created_employee.id
    assert retrieved_employee.name == "Get Me User"

    non_existent_employee = employee_service.get_employee(db_session, 99999) # Non-existent ID
    assert non_existent_employee is None

def test_get_employees_by_restaurant_service(db_session: Session):
    # Restaurant and one employee are created in fixture, let's add more for this restaurant
    emp1_data = EmployeeCreate(name="Emp1_R1", role="Chef", restaurant_id=test_restaurant_id, hourly_rate=20)
    employee_service.create_employee(db_session, emp1_data)

    emp2_data = EmployeeCreate(name="Emp2_R1", role="Waiter", restaurant_id=test_restaurant_id, hourly_rate=15)
    employee_service.create_employee(db_session, emp2_data)

    # Create another restaurant and an employee for it to test isolation
    other_restaurant_id = uuid.uuid4()
    other_restaurant = Restaurant(id=other_restaurant_id, name="Other Restaurant", address={"city":"Otherville"})
    db_session.add(other_restaurant)
    db_session.commit()
    emp3_data = EmployeeCreate(name="Emp3_R2", role="Manager", restaurant_id=other_restaurant_id, hourly_rate=30)
    employee_service.create_employee(db_session, emp3_data)

    employees_r1 = employee_service.get_employees_by_restaurant(db_session, test_restaurant_id)
    assert len(employees_r1) == 2 # emp1_data, emp2_data
    employee_names_r1 = {emp.name for emp in employees_r1}
    assert "Emp1_R1" in employee_names_r1
    assert "Emp2_R1" in employee_names_r1

    employees_r2 = employee_service.get_employees_by_restaurant(db_session, other_restaurant_id)
    assert len(employees_r2) == 1
    assert employees_r2[0].name == "Emp3_R2"

    # Test pagination (limit)
    employees_r1_limit1 = employee_service.get_employees_by_restaurant(db_session, test_restaurant_id, limit=1)
    assert len(employees_r1_limit1) == 1

    # Test pagination (skip)
    employees_r1_skip1 = employee_service.get_employees_by_restaurant(db_session, test_restaurant_id, skip=1, limit=1)
    assert len(employees_r1_skip1) == 1
    # Ensure skipped employee is different from the first one (depends on ordering, usually by PK)
    assert employees_r1_limit1[0].id != employees_r1_skip1[0].id


def test_update_employee_service(db_session: Session):
    employee_create_data = EmployeeCreate(
        name="Update User",
        role="Original Role",
        restaurant_id=test_restaurant_id,
        hourly_rate=40.0,
        status="active"
    )
    employee = employee_service.create_employee(db_session, employee_create_data)

    update_data = EmployeeUpdate(name="Updated User Name", role="New Role", status="inactive")
    updated_employee = employee_service.update_employee(db_session, employee.id, update_data)

    assert updated_employee is not None
    assert updated_employee.name == "Updated User Name"
    assert updated_employee.role == "New Role"
    assert updated_employee.status == "inactive"
    assert updated_employee.hourly_rate == 40.0 # Unchanged

    # Test partial update
    partial_update_data = EmployeeUpdate(hourly_rate=45.5)
    further_updated_employee = employee_service.update_employee(db_session, employee.id, partial_update_data)
    assert further_updated_employee.hourly_rate == 45.5
    assert further_updated_employee.name == "Updated User Name" # Should remain from previous update

    non_existent_update = employee_service.update_employee(db_session, 9999, EmployeeUpdate(name="Ghost"))
    assert non_existent_update is None

def test_delete_employee_service(db_session: Session):
    employee_create_data = EmployeeCreate(
        name="Delete User",
        role="Deleter",
        restaurant_id=test_restaurant_id,
        hourly_rate=50.0,
        status="active"
    )
    employee_to_delete = employee_service.create_employee(db_session, employee_create_data)

    deleted_employee = employee_service.delete_employee(db_session, employee_to_delete.id)
    assert deleted_employee is not None
    assert deleted_employee.id == employee_to_delete.id

    # Verify it's actually deleted
    retrieved_after_delete = employee_service.get_employee(db_session, employee_to_delete.id)
    assert retrieved_after_delete is None

    non_existent_delete = employee_service.delete_employee(db_session, 9999)
    assert non_existent_delete is None
