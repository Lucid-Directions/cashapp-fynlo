import asyncio
import uuid # For generating restaurant_id if needed, or use a fixed one

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.models import Employee, Restaurant # Assuming Restaurant model is in app.models

# Mock data for employees
mock_employees_data = [
    {
        "name": "Sarah Johnson",
        "role": "manager",
        "hourly_rate": 15.50,
        "status": "active"
    },
    {
        "name": "Mike Brown",
        "role": "chef",
        "hourly_rate": 18.00,
        "status": "active"
    },
    {
        "name": "Emma Davis",
        "role": "waitress",
        "hourly_rate": 12.75,
        "status": "active"
    },
    # Add more test employees if needed
]

async def seed_employee_data(db: Session, restaurant_id: uuid.UUID):
    """
    Seeds the database with mock employee data for a given restaurant.
    """
    existing_employee_names = {emp.name for emp in db.query(Employee.name).filter(Employee.restaurant_id == restaurant_id).all()}

    for emp_data in mock_employees_data:
        if emp_data["name"] not in existing_employee_names:
            employee = Employee(
                name=emp_data["name"],
                role=emp_data["role"],
                restaurant_id=restaurant_id,
                hourly_rate=emp_data["hourly_rate"],
                status=emp_data["status"]
            )
            db.add(employee)
            print(f"Adding employee: {employee.name} for restaurant {restaurant_id}")
        else:
            print(f"Employee {emp_data['name']} already exists for restaurant {restaurant_id}, skipping.")
    db.commit()

async def ensure_restaurant_exists(db: Session, restaurant_name: str = "Test Restaurant") -> uuid.UUID:
    """
    Ensures a restaurant exists or creates one, returning its ID.
    This is a placeholder. In a real system, you'd likely have a fixed ID
    or a more robust way to select/create restaurants.
    """
    restaurant = db.query(Restaurant).filter(Restaurant.name == restaurant_name).first()
    if not restaurant:
        print(f"Creating test restaurant: {restaurant_name}")
        # Using a fixed UUID for simplicity in a test script.
        # In a real scenario, this might be dynamically generated or configured.
        fixed_restaurant_id = uuid.UUID("00000000-0000-0000-0000-000000000001")

        # Check if a restaurant with this ID already exists
        existing_restaurant_with_id = db.query(Restaurant).filter(Restaurant.id == fixed_restaurant_id).first()
        if existing_restaurant_with_id:
            print(f"Restaurant with ID {fixed_restaurant_id} already exists, but has name {existing_restaurant_with_id.name}. Using this one.")
            return existing_restaurant_with_id.id

        restaurant = Restaurant(
            id=fixed_restaurant_id,
            name=restaurant_name,
            address={"street": "123 Main St", "city": "Anytown"}, # Example address
            # other fields as required by your Restaurant model
        )
        db.add(restaurant)
        db.commit()
        db.refresh(restaurant)
        print(f"Created restaurant {restaurant.name} with ID {restaurant.id}")
        return restaurant.id
    else:
        print(f"Restaurant {restaurant.name} already exists with ID {restaurant.id}")
        return restaurant.id

async def main_seed():
    print("Starting database seeding...")
    db: Session = SessionLocal()
    try:
        # 1. Ensure tables are created (Alembic should handle this in prod, but good for standalone script)
        # Base.metadata.create_all(bind=engine) # Usually handled by Alembic

        # 2. Get or create a restaurant ID
        # For this script, we'll use a default/test restaurant.
        # IMPORTANT: Replace "restaurant1" with an actual UUID or logic to get/create a restaurant.
        # For now, let's create a dummy restaurant if it doesn't exist.
        restaurant_id = await ensure_restaurant_exists(db, "The Mock Cantina")

        if restaurant_id:
            # 3. Seed employee data
            print(f"Seeding employee data for restaurant ID: {restaurant_id}")
            await seed_employee_data(db, restaurant_id=restaurant_id)
            print("Employee data seeding complete.")
        else:
            print("Could not obtain a restaurant ID. Skipping employee seeding.")

        # Add other seeding functions here if needed
        # await seed_inventory_data(db, restaurant_id=restaurant_id)
        # await seed_schedule_data(db, restaurant_id=restaurant_id)

        print("Database seeding finished.")
    except Exception as e:
        print(f"An error occurred during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    # This allows running the script directly: python -m app.scripts.database_seed_migration
    # Ensure your PYTHONPATH is set correctly for app imports.
    # Example: PYTHONPATH=. python backend/app/scripts/database_seed_migration.py
    print("Running seed script...")
    asyncio.run(main_seed())
