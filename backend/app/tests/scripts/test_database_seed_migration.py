import pytest
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
import uuid

from app.core.database import Base # To create/drop tables
from app.models import Employee, Restaurant
from app.scripts.database_seed_migration import main_seed, mock_employees_data, ensure_restaurant_exists

# Use an in-memory SQLite database for testing the script
# This should be separate from the one used by API/service tests if run in parallel
# or ensure proper cleanup. For simplicity, using a new engine here.
SQLALCHEMY_DATABASE_URL_SCRIPT_TEST = "sqlite:///:memory:?cache=shared" # Shared cache for async
engine_script_test = create_engine(SQLALCHEMY_DATABASE_URL_SCRIPT_TEST, connect_args={"check_same_thread": False})
TestingSessionLocalScript = sessionmaker(autocommit=False, autoflush=False, bind=engine_script_test)

# Override SessionLocal for the script during testing
from app.scripts import database_seed_migration # Import the module itself
original_session_local = database_seed_migration.SessionLocal # Store original
database_seed_migration.SessionLocal = TestingSessionLocalScript # Monkeypatch

@pytest.fixture(scope="function")
def db_session_for_script():
    Base.metadata.create_all(bind=engine_script_test) # Create tables
    db = TestingSessionLocalScript()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine_script_test) # Drop tables after test

@pytest.mark.asyncio
async def test_ensure_restaurant_exists_creates_new(db_session_for_script: Session):
    # Override the db session for the ensure_restaurant_exists function if it doesn't use SessionLocal directly
    # For this test, we'll call it directly with our test session

    restaurant_name = "Seed Script Test Restaurant New"
    # Ensure no restaurant with this name exists
    existing = db_session_for_script.query(Restaurant).filter(Restaurant.name == restaurant_name).first()
    assert existing is None

    restaurant_id = await ensure_restaurant_exists(db_session_for_script, restaurant_name)
    assert restaurant_id is not None

    created_restaurant = db_session_for_script.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    assert created_restaurant is not None
    assert created_restaurant.name == restaurant_name
    # Check if the fixed UUID from the script was used (if name was "The Mock Cantina")
    if restaurant_name == "The Mock Cantina":
         assert restaurant_id == uuid.UUID("00000000-0000-0000-0000-000000000001")


@pytest.mark.asyncio
async def test_ensure_restaurant_exists_returns_existing(db_session_for_script: Session):
    restaurant_name = "Seed Script Test Restaurant Existing"
    existing_id = uuid.uuid4()
    restaurant = Restaurant(id=existing_id, name=restaurant_name, address={"city": "ExistingVille"})
    db_session_for_script.add(restaurant)
    db_session_for_script.commit()

    restaurant_id = await ensure_restaurant_exists(db_session_for_script, restaurant_name)
    assert restaurant_id == existing_id

    count = db_session_for_script.query(Restaurant).filter(Restaurant.name == restaurant_name).count()
    assert count == 1 # Should not create a new one

@pytest.mark.asyncio
async def test_main_seed_populates_data(db_session_for_script: Session):
    # This test runs the entire main_seed function

    # Before running, check the count of employees for the target restaurant (if it could exist)
    # The script uses "The Mock Cantina" and a fixed UUID.
    fixed_restaurant_id = uuid.UUID("00000000-0000-0000-0000-000000000001")

    # Run the seeding process
    await main_seed() # This will use the monkeypatched SessionLocal

    # Verify data after seeding, using a new session to ensure data is committed
    db_verify_session = TestingSessionLocalScript()
    try:
        # Check if the restaurant was created
        restaurant = db_verify_session.query(Restaurant).filter(Restaurant.id == fixed_restaurant_id).first()
        assert restaurant is not None
        assert restaurant.name == "The Mock Cantina"

        # Check if employees were added
        employees = db_verify_session.query(Employee).filter(Employee.restaurant_id == fixed_restaurant_id).all()
        assert len(employees) == len(mock_employees_data)

        seeded_employee_names = {emp.name for emp in employees}
        for mock_emp in mock_employees_data:
            assert mock_emp["name"] in seeded_employee_names
            # Further checks for role, rate, etc. can be added
            db_emp = next(e for e in employees if e.name == mock_emp["name"])
            assert db_emp.role == mock_emp["role"]
            assert db_emp.hourly_rate == mock_emp["hourly_rate"]
            assert db_emp.status == mock_emp["status"]
    finally:
        db_verify_session.close()

@pytest.mark.asyncio
async def test_main_seed_idempotency(db_session_for_script: Session):
    # Run seed first time
    await main_seed()

    db_first_run_session = TestingSessionLocalScript()
    try:
        employees_after_first_run = db_first_run_session.query(Employee).count()
        restaurants_after_first_run = db_first_run_session.query(Restaurant).count()
        assert employees_after_first_run == len(mock_employees_data)
    finally:
        db_first_run_session.close()

    # Run seed second time
    await main_seed()

    db_second_run_session = TestingSessionLocalScript()
    try:
        # Number of employees and restaurants should remain the same
        employees_after_second_run = db_second_run_session.query(Employee).count()
        restaurants_after_second_run = db_second_run_session.query(Restaurant).count()

        assert employees_after_second_run == employees_after_first_run, "Employee count changed on second seed run."
        assert restaurants_after_second_run == restaurants_after_first_run, "Restaurant count changed on second seed run."

        # Verify specific employee data to ensure no duplicates or unwanted changes
        fixed_restaurant_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
        sarah_johnson = db_second_run_session.query(Employee).filter(
            Employee.name == "Sarah Johnson",
            Employee.restaurant_id == fixed_restaurant_id
        ).first()
        assert sarah_johnson is not None
        assert sarah_johnson.role == "manager"
        # Count how many Sarah Johnsons for this restaurant
        sarah_count = db_second_run_session.query(Employee).filter(
            Employee.name == "Sarah Johnson",
            Employee.restaurant_id == fixed_restaurant_id
        ).count()
        assert sarah_count == 1, "Duplicate Sarah Johnson created."

    finally:
        db_second_run_session.close()
        # Restore original SessionLocal after tests in this module are done
        database_seed_migration.SessionLocal = original_session_local

# To run these tests:
# Ensure PYTHONPATH includes the project root. Example: PYTHONPATH=. pytest backend/app/tests/scripts/test_database_seed_migration.py
# Need to install pytest-asyncio: pip install pytest-asyncio
# The monkeypatching of SessionLocal is crucial for the script to use the test DB.
# Ensure the script's main_seed and other functions use the SessionLocal from its own module, not a global import from elsewhere.
# The script was written as: from app.core.database import SessionLocal
# This needs to be adjusted for monkeypatching to work easily.
# The current script:
# backend/app/scripts/database_seed_migration.py uses:
# from app.core.database import SessionLocal, engine, Base
# To make monkeypatching effective for `main_seed`, it should use `database_seed_migration.SessionLocal`
# if `SessionLocal` is also imported into `database_seed_migration`'s namespace like:
# `from app.core.database import SessionLocal` (which it is).
# The current patching: `database_seed_migration.SessionLocal = TestingSessionLocalScript` should work.
