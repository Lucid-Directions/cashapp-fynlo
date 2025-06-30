import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from uuid_extensions import uuid7 # Assuming usage of uuid7 for restaurant_id for consistency
import uuid

from app.core.database import Base, get_db # For Base and test DB session
from app.models import Employee, Restaurant # Import models

# Use an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Pytest fixture to set up and tear down the database for each test function
@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine) # Create tables
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine) # Drop tables after test

# Fixture to override the get_db dependency in endpoint tests if needed elsewhere,
# but for model tests, we use db_session directly.
@pytest.fixture(scope="module")
def test_app_with_db_override(client): # Assuming 'client' fixture from conftest.py
    # This is more for API tests, but good to have a pattern
    from app.main import app # Assuming your FastAPI app instance is here
    app.dependency_overrides[get_db] = lambda: TestingSessionLocal()
    yield client # Or app, depending on how you test FastAPI
    app.dependency_overrides.clear()


def test_create_employee(db_session: Session):
    # Create a dummy restaurant for the foreign key constraint
    # Using a fixed UUID for the restaurant for predictability in tests
    test_restaurant_id = uuid.UUID("123e4567-e89b-12d3-a456-426614174000")

    restaurant = Restaurant(
        id=test_restaurant_id,
        name="Test Restaurant",
        address={"street": "123 Test St", "city": "Testville"}
    )
    db_session.add(restaurant)
    db_session.commit()
    db_session.refresh(restaurant)

    employee_data = {
        "name": "Test User",
        "role": "Tester",
        "restaurant_id": test_restaurant_id,
        "hourly_rate": 20.0,
        "status": "active"
    }
    employee = Employee(**employee_data)
    db_session.add(employee)
    db_session.commit()
    db_session.refresh(employee)

    assert employee.id is not None
    assert employee.name == "Test User"
    assert employee.role == "Tester"
    assert employee.restaurant_id == test_restaurant_id
    assert employee.hourly_rate == 20.0
    assert employee.status == "active"
    assert employee.restaurant is not None
    assert employee.restaurant.name == "Test Restaurant"

def test_employee_restaurant_relationship(db_session: Session):
    test_restaurant_id = uuid.uuid4() # Using dynamic UUID here
    restaurant = Restaurant(
        id=test_restaurant_id,
        name="Another Test Restaurant",
        address={"street": "456 Test Ave", "city": "Testburg"}
    )
    db_session.add(restaurant)
    db_session.commit()

    employee1 = Employee(name="Emp1", role="dev", restaurant_id=test_restaurant_id, hourly_rate=25, status="active")
    employee2 = Employee(name="Emp2", role="qa", restaurant_id=test_restaurant_id, hourly_rate=22, status="active")

    db_session.add_all([employee1, employee2])
    db_session.commit()

    # Query the restaurant and check its employees
    retrieved_restaurant = db_session.query(Restaurant).filter(Restaurant.id == test_restaurant_id).one()
    assert len(retrieved_restaurant.employees) == 2
    employee_names = {emp.name for emp in retrieved_restaurant.employees}
    assert "Emp1" in employee_names
    assert "Emp2" in employee_names

    # Query an employee and check its restaurant
    retrieved_employee = db_session.query(Employee).filter(Employee.name == "Emp1").one()
    assert retrieved_employee.restaurant is not None
    assert retrieved_employee.restaurant.name == "Another Test Restaurant"
    assert retrieved_employee.restaurant_id == test_restaurant_id
    assert retrieved_employee.restaurant == retrieved_restaurant

# Add more tests for constraints, defaults, etc. if necessary
# For example, testing if restaurant_id is required, or default status.
# However, these are often better tested at the service/API layer for business logic.
# Model tests primarily focus on DB schema representation and basic ORM functionality.
