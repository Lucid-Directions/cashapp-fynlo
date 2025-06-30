import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app # Your FastAPI application
from app.core.database import Base, get_db
import os

# Determine database URL (SQLite in-memory for tests)
# Fallback to a file-based SQLite if needed for debugging or specific test scenarios
SQLALCHEMY_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} # Needed for SQLite
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override the get_db dependency to use the test database
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    # Create tables at the beginning of the session
    Base.metadata.create_all(bind=engine)
    yield
    # Drop tables at the end of the session
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function") # function scope for db ensures isolation between tests
def db_session_for_api_tests():
    # This fixture can be used if tests need to directly interact with db
    # separate from TestClient requests
    Base.metadata.create_all(bind=engine) # Ensure tables are created if not using session-scoped setup_test_db
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Base.metadata.drop_all(bind=engine) # Dropping tables per function might be too slow, use session scope

@pytest.fixture(scope="module")
def client():
    # Override dependency for the test client
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear() # Clear overrides after tests
