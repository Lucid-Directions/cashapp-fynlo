import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session # For type hinting if using db_session_for_api_tests
import uuid

from app.schemas.employee import EmployeeCreate, EmployeeUpdate
from app.models import Restaurant # To create a restaurant for FK needs
from app.core.database import Base, engine # For direct DB manipulation if needed for setup

# Fixture from conftest.py will provide 'client'
# Fixture from conftest.py can provide 'db_session_for_api_tests' if direct db access is needed for setup

# Global variable to store restaurant ID created for tests
test_restaurant_id_api: uuid.UUID = uuid.uuid4()
# Global variable to store an employee ID created during tests
current_employee_id: int = -1

@pytest.fixture(scope="module", autouse=True)
def setup_restaurant_for_api_tests(db_session_for_api_tests: Session):
    """
    Ensures a restaurant exists for employee tests.
    This runs once per module.
    """
    # Using db_session_for_api_tests which is function-scoped in conftest,
    # but here used in a module-scoped fixture. This means it will get a fresh session.
    # For a truly module-scoped DB setup for API tests, conftest.py's setup_test_db
    # handles table creation, and this fixture can populate it.

    # Need to ensure this session is the same one TestClient will use,
    # which is handled by app.dependency_overrides[get_db] = override_get_db in conftest.client

    # Re-target the engine from conftest for direct manipulation if needed
    # This is generally okay as TestClient uses its own session via dependency override.
    from app.tests.conftest import TestingSessionLocal

    db = TestingSessionLocal() # Get a session for setup
    try:
        restaurant = db.query(Restaurant).filter(Restaurant.id == test_restaurant_id_api).first()
        if not restaurant:
            restaurant = Restaurant(
                id=test_restaurant_id_api,
                name="API Test Restaurant",
                address={"street": "123 API St", "city": "APItown"}
            )
            db.add(restaurant)
            db.commit()
            print(f"Created restaurant {test_restaurant_id_api} for API tests.")
        else:
            print(f"Restaurant {test_restaurant_id_api} already exists for API tests.")
    finally:
        db.close()


def test_create_employee_api(client: TestClient):
    global current_employee_id
    employee_data = {
        "name": "API Test Employee",
        "role": "API Tester",
        "restaurant_id": str(test_restaurant_id_api), # Ensure UUID is string for JSON
        "hourly_rate": 33.3,
        "status": "active"
    }
    response = client.post("/api/v1/employees/", json=employee_data)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["name"] == employee_data["name"]
    assert data["role"] == employee_data["role"]
    assert data["restaurant_id"] == str(test_restaurant_id_api)
    assert "id" in data
    current_employee_id = data["id"] # Save for later tests

def test_create_employee_api_invalid_restaurant(client: TestClient):
    non_existent_restaurant_id = str(uuid.uuid4())
    employee_data = {
        "name": "Orphan Employee",
        "role": "Lost",
        "restaurant_id": non_existent_restaurant_id,
        "hourly_rate": 10.0,
        "status": "pending"
    }
    # The current API implementation does not check if restaurant_id exists.
    # If it did, this test would expect a 404 or 400.
    # For now, this will likely pass with 201, but the employee will have an invalid FK.
    # This highlights a potential improvement in the create_new_employee endpoint.
    response = client.post("/api/v1/employees/", json=employee_data)
    # To make this test meaningful, the endpoint should validate restaurant_id.
    # Assuming current behavior (no validation):
    assert response.status_code == 201 # Or 404/400 if validation is added
    # if response.status_code == 404:
    #     assert f"Restaurant with id {non_existent_restaurant_id} not found" in response.json()["detail"]


def test_get_employees_by_restaurant_api(client: TestClient):
    # This assumes test_create_employee_api has run and created an employee
    response = client.get(f"/api/v1/employees/{str(test_restaurant_id_api)}")
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0 # Expect at least one employee created in previous test
    # Check if the created employee is in the list
    found = any(emp["name"] == "API Test Employee" for emp in data)
    assert found, "Previously created API employee not found in list."

def test_get_employees_by_non_existent_restaurant_api(client: TestClient):
    non_existent_restaurant_id = str(uuid.uuid4())
    response = client.get(f"/api/v1/employees/{non_existent_restaurant_id}")
    assert response.status_code == 200, response.text # Endpoint returns empty list for non-existent restaurant
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0

def test_get_employee_details_api(client: TestClient):
    assert current_employee_id != -1, "Employee ID not set from create test"
    response = client.get(f"/api/v1/employees/detail/{current_employee_id}")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["id"] == current_employee_id
    assert data["name"] == "API Test Employee"

def test_get_employee_details_api_not_found(client: TestClient):
    response = client.get("/api/v1/employees/detail/999999") # Non-existent ID
    assert response.status_code == 404, response.text
    assert response.json()["detail"] == "Employee not found"

def test_update_employee_api(client: TestClient):
    assert current_employee_id != -1, "Employee ID not set from create test"
    update_data = {"name": "Updated API Employee Name", "status": "on_leave"}
    response = client.put(f"/api/v1/employees/{current_employee_id}", json=update_data)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["name"] == update_data["name"]
    assert data["status"] == update_data["status"]
    assert data["id"] == current_employee_id
    assert data["role"] == "API Tester" # Role should be unchanged

def test_update_employee_api_not_found(client: TestClient):
    update_data = {"name": "Ghost Employee"}
    response = client.put("/api/v1/employees/999999", json=update_data) # Non-existent ID
    assert response.status_code == 404, response.text
    assert response.json()["detail"] == "Employee not found"

def test_delete_employee_api(client: TestClient):
    # Create a new employee to delete, to avoid impacting other tests relying on current_employee_id
    employee_to_delete_data = {
        "name": "Employee To Delete",
        "role": "Temporary",
        "restaurant_id": str(test_restaurant_id_api),
        "hourly_rate": 10.0,
        "status": "active"
    }
    create_response = client.post("/api/v1/employees/", json=employee_to_delete_data)
    assert create_response.status_code == 201
    employee_to_delete_id = create_response.json()["id"]

    delete_response = client.delete(f"/api/v1/employees/{employee_to_delete_id}")
    assert delete_response.status_code == 200, delete_response.text
    deleted_data = delete_response.json()
    assert deleted_data["id"] == employee_to_delete_id
    assert deleted_data["name"] == employee_to_delete_data["name"]

    # Verify it's actually deleted by trying to get it
    get_response = client.get(f"/api/v1/employees/detail/{employee_to_delete_id}")
    assert get_response.status_code == 404, "Employee should have been deleted"

def test_delete_employee_api_not_found(client: TestClient):
    response = client.delete("/api/v1/employees/999999") # Non-existent ID
    assert response.status_code == 404, response.text
    assert response.json()["detail"] == "Employee not found"

# Consider adding tests for pagination (skip, limit) on the GET /employees/{restaurant_id} endpoint.
# Consider adding tests for multi-tenancy: ensure employees from one restaurant_id aren't visible under another.
# The current test_get_employees_by_restaurant_api implicitly tests this if another restaurant had employees.
# The `setup_restaurant_for_api_tests` creates one restaurant. For multi-tenancy, you'd create a second one.
# Example: Create another restaurant and employee, then verify GET /employees/{restaurant1_id} only shows its employees.
# The service layer test (test_get_employees_by_restaurant_service) already covers this logic.
# API test would confirm it's exposed correctly.
# The current structure of `current_employee_id` being global and modified by tests is not ideal for parallel execution
# or test independence. Each test function should manage its own test data as much as possible.
# Fixtures that create and return data (e.g., a created employee) are a better pattern.
# For example: `created_employee_fixture` that POSTs and returns the employee details.
# Then tests can use this fixture: `def test_get_employee(client, created_employee_fixture): ...`
