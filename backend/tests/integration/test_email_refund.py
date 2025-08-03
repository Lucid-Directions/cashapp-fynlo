import os
import uuid
from unittest.mock import patch, MagicMock
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app # Assuming your FastAPI app instance is here
from app.core.database import Order, Product, Category, User # Import models used for seeding
from app.api.v1.endpoints.auth import create_access_token # For authenticated requests

# It's good practice to use a separate test database or ensure cleanup.
# For now, assuming tests run against a test DB or are designed to be non-destructive/idempotent.

@pytest.fixture(scope="module")
def client():
    return TestClient(app)

@pytest.fixture(scope="function")
def db_session(client): # client fixture ensures app is initialized
    # This would ideally use a test-specific database session setup
    # For now, let's assume we can get a session like in the app
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="function")
def seeded_order(db_session: Session):
    # Create a mock user (customer)
    customer_email = f"customer_{uuid.uuid4()}@example.com"
    customer = User(
        id=uuid.uuid4(),
        email=customer_email,
        username=customer_email,
        password_hash="hashed_password", # Not used for this test directly
        first_name="Test",
        last_name="Customer",
        role="customer", # Assuming a customer role or just using User model
        is_active=True
    )
    db_session.add(customer)
    db_session.flush()


    # Create a mock product
    category = Category(id=uuid.uuid4(), restaurant_id=uuid.uuid4(), name="Drinks")
    db_session.add(category)
    db_session.flush()

    product = Product(
        id=uuid.uuid4(),
        restaurant_id=category.restaurant_id,
        category_id=category.id,
        name="Test Soda",
        price=Decimal("2.50"),
        is_active=True
    )
    db_session.add(product)
    db_session.flush()

    # Create a mock order
    order_items = [{
        "product_id": str(product.id),
        "product_name": product.name, # Template might use this
        "quantity": 2,
        "unit_price": float(product.price),
        "total_price": float(product.price * 2)
    }]
    order = Order(
        id=uuid.uuid4(),
        restaurant_id=category.restaurant_id,
        customer_id=customer.id, # Link to the customer
        order_number=f"ORD_TEST_{uuid.uuid4().hex[:6]}",
        status="completed", # Must be completed to allow refund
        items=order_items,
        subtotal=Decimal("5.00"),
        tax_amount=Decimal("1.00"),
        service_charge=Decimal("0.50"),
        total_amount=Decimal("6.50"),
        payment_status="paid",
        created_by=customer.id, # Or a staff user ID
        # Add customer_email directly to Order model if it exists, or rely on customer_id join
        # For this test, we'll assume the endpoint logic can fetch it via customer_id
        # Or, if Order model has customer_email:
        # customer_email=customer_email
    )
    # If Order model has customer_email, set it:
    # setattr(order, 'customer_email', customer_email) # If not a direct Column

    db_session.add(order)
    db_session.commit()
    db_session.refresh(order)
    db_session.refresh(customer) # Ensure customer email is available if fetched via relationship

    # Add a mock payment transaction ID and provider if your refund logic needs it
    # This depends on how your Order model stores this.
    # For example, if it's a JSON field:
    # order.payment_details = {"transaction_id": "mock_txn_123", "provider": "square"}
    # Or direct columns:
    setattr(order, 'payment_transaction_id', f"mock_txn_{uuid.uuid4().hex[:6]}")
    setattr(order, 'payment_provider_code', "square") # Or 'cash' if testing cash refund path
    db_session.commit()
    db_session.refresh(order)

    return order


@pytest.fixture(scope="function")
def manager_token(db_session: Session):
    # Create a manager user for authentication
    manager_email = f"manager_{uuid.uuid4()}@example.com"
    manager_user = User(
        id=uuid.uuid4(),
        email=manager_email,
        username=manager_email,
        password_hash="hashed_password_manager", # Actual hash of a known password
        first_name="Test",
        last_name="Manager",
        role="Manager", # Ensure this role matches what endpoint checks
        is_active=True,
        restaurant_id=uuid.uuid4() # Associate with a restaurant if needed
    )
    db_session.add(manager_user)
    db_session.commit()

    # Generate a token for this manager
    # The actual token generation might depend on your auth setup
    # Assuming a simple function `create_access_token` exists and works like in auth.py
    token_data = {"sub": manager_email, "user_id": str(manager_user.id), "role": "Manager"}
    return create_access_token(data=token_data)


def test_refund_sends_email(client: TestClient, db_session: Session, seeded_order: Order, manager_token: str):
    """Test that processing a refund triggers an email send operation."""
    pass  # TODO: Implement

    # Ensure SENDGRID_API_KEY is set for the test environment (can be a dummy value)
    # The EmailService init checks for this.
    os.environ["SENDGRID_API_KEY"] = "test_sendgrid_api_key"
    os.environ["EMAIL_FROM"] = "test-sender@fynlo.com"

    # The order.items list from DB is a list of dicts.
    # The refund request expects 'lineId' which should map to product_id in this item structure.
    line_to_refund = seeded_order.items[0]

    refund_payload = {
        "items": [{
            "line_id": line_to_refund["product_id"], # Map to the product_id from the order item
            "qty": 1
        }],
        "reason": "Test refund quality issue"
    }

    # Patch the SendGridAPIClient's send method within the email_service module
    # Ensure the path to SendGridAPIClient is correct as used by EmailService
    with patch("app.services.email_service.SendGridAPIClient.send") as mocked_sendgrid_send:
        mocked_sendgrid_send.return_value = MagicMock(status_code=202) # Simulate successful send

        response = client.post(
            f"/api/v1/orders/{str(seeded_order.id)}/refund", # Ensure your router prefix is /api/v1
            json=refund_payload,
            headers={"Authorization": f"Bearer {manager_token}"}
        )

        assert response.status_code == 200, f"Refund request failed: {response.text}"

        mocked_sendgrid_send.assert_called_once()

        # Inspect the arguments passed to sendgrid.send()
        # args[0] should be the Mail object
        sent_mail_object = mocked_sendgrid_send.call_args[0][0]

        # Check subject
        assert "Refund for" in sent_mail_object.subject.subject, f"Email subject was: {sent_mail_object.subject.subject}"

        # Check recipient (assuming seeded_order.customer.email exists and was populated)
        # The endpoint logic tries to find customer_email from order.customer_id via User model
        customer = db_session.query(User).filter(User.id == seeded_order.customer_id).first()
        assert customer is not None
        assert customer.email is not None

        # to_emails is a list of Email objects
        assert len(sent_mail_object.personalizations[0].tos) == 1
        assert sent_mail_object.personalizations[0].tos[0]['email'] == customer.email

        # Check email content (optional, more involved)
        html_content = sent_mail_object.contents[0].content # Assuming first content is HTML
        assert "A refund of" in html_content
        assert "£1.25" in html_content or "£2.50" in html_content # Depending on how amount is calculated/passed

        # Check that the environment variables were reverted if set only for this test
        # (pytest fixtures can handle this setup/teardown better)

    # Clean up test data (important if not using a transaction-based test DB setup)
    # db_session.delete(seeded_order)
    # ... delete other created objects ...
    # db_session.commit()
    # For this example, we assume db_session fixture handles rollback or test DB is ephemeral.
    # If not, ensure cleanup to avoid test interference.

    # Example cleanup (if db_session doesn't auto-rollback or if objects persist across tests)
    # This is simplified; a proper fixture setup is better.
    # Cleanup is important. If using a real DB, ensure transactions are rolled back
    # or specific cleanup logic is implemented. Pytest fixtures with transactions are good for this.
    # For this example, manual cleanup is shown but might be error-prone.

    # It's often better to let the db_session fixture handle transaction rollback.
    # If your db_session fixture is set up to rollback transactions after each test,
    # explicit deletion might not be necessary.
    # If not, then:
    try:
        # Reload objects in session if they became detached or if state is uncertain
        # This might not be needed if session management is robust
        db_session.expire_all() # Clears cached attributes, forces reload on next access if needed

        from app.models.refund import Refund, RefundLedger
        # It's safer to query for the IDs again rather than using potentially detached objects.
        # Example: find refund by order_id if that's unique enough for test context, or by a returned refund_id.

        # Assuming 'response.json()["id"]' gives the created refund_id from RefundResponseSchema
        # This part of cleanup should only run if the response was successful and contained an ID
        if response.status_code == 200:
            created_refund_id = response.json().get("id")
            if created_refund_id:
                # Query for ledger entries related to this refund and delete them
                ledger_entries_to_delete = db_session.query(RefundLedger).filter(RefundLedger.refund_id == created_refund_id).all()
                for le in ledger_entries_to_delete:
                    db_session.delete(le)

                # Query for the refund itself and delete it
                refund_to_delete = db_session.query(Refund).filter(Refund.id == created_refund_id).first()
                if refund_to_delete:
                    db_session.delete(refund_to_delete)

        # Delete other seeded data if they are not cleaned up by fixture scope
        # For example, if manager_token fixture does not clean up the manager_user:
        # Need to access token_data from manager_token fixture if not passed directly
        # For simplicity, assume manager_user is cleaned up by its fixture or test session scope.

        order_to_delete = db_session.query(Order).filter(Order.id == seeded_order.id).first()
        if order_to_delete:
            db_session.delete(order_to_delete)

        customer_to_delete = db_session.query(User).filter(User.id == seeded_order.customer_id).first()
        if customer_to_delete:
             db_session.delete(customer_to_delete)

        # Product and Category might be shared or created per test.
        # If created per test by seeded_order, they should be cleaned.
        # Assuming product_id is stored in items.
        if seeded_order.items and len(seeded_order.items) > 0:
            product_id_to_delete = seeded_order.items[0].get("product_id")
            product_to_delete = db_session.query(Product).filter(Product.id == product_id_to_delete).first()
            if product_to_delete:
                category_to_delete = db_session.query(Category).filter(Category.id == product_to_delete.category_id).first()
                if category_to_delete:
                    db_session.delete(category_to_delete)
                db_session.delete(product_to_delete)

        db_session.commit()
    except Exception as e:
        logger.error(f"Error during test cleanup: {e}")
        db_session.rollback()


@patch("app.services.payment_factory.PaymentProviderFactory.get_provider") # Patch get_provider which is used by get_refund_provider
def test_refund_gateway_success(
    mock_get_payment_provider, client: TestClient, db_session: Session, seeded_order: Order, manager_token: str
):
    """Test the refund flow when the payment gateway successfully processes the refund."""
    os.environ["SENDGRID_API_KEY"] = "test_sendgrid_api_key"
    os.environ["EMAIL_FROM"] = "test-sender@fynlo.com"

    mock_provider_instance = MagicMock()
    # Simulate successful gateway refund
    # The refund_payment method is async, so the MagicMock needs to be an async mock or its return_value needs to be an awaitable
    async def mock_refund_payment(*args, **kwargs):
        return {
            "success": True,
            "refund_id": "gw_refund_success_123",
            "status": "processed",
            "amount_refunded": Decimal("2.50"),
            "raw_response": {"message": "Gateway refund successful"}
        }
    mock_provider_instance.refund_payment = MagicMock(side_effect=mock_refund_payment)
    mock_get_payment_provider.return_value = mock_provider_instance


    line_to_refund = seeded_order.items[0]
    refund_payload = {
        "items": [{"line_id": line_to_refund["product_id"], "qty": 1}],
        "reason": "Gateway success test"
    }

    with patch("app.services.email_service.SendGridAPIClient.send", MagicMock(return_value=MagicMock(status_code=202))):
        response = client.post(
            f"/api/v1/orders/{str(seeded_order.id)}/refund",
            json=refund_payload,
            headers={"Authorization": f"Bearer {manager_token}"}
        )

    assert response.status_code == 200, f"Refund request failed: {response.text}"
    response_data = response.json()
    assert response_data["status"] == "processed"
    assert response_data["gateway_refund_id"] == "gw_refund_success_123"
    assert Decimal(str(response_data["amount"])) == Decimal("2.50")

    db_session.refresh(seeded_order)
    assert seeded_order.status == "partially_refunded"

    from app.models.refund import Refund, RefundLedger
    refund_entry = db_session.query(Refund).filter(Refund.order_id == str(seeded_order.id)).first()
    assert refund_entry is not None
    assert refund_entry.amount == Decimal("2.50")
    assert refund_entry.state == "done"

    ledger_entry = db_session.query(RefundLedger).filter(RefundLedger.refund_id == refund_entry.id).first()
    assert ledger_entry is not None
    assert ledger_entry.action == "refund_processed"

    # Simplified cleanup for this test - assumes seeded_order fixture might handle its own primary entities
    if ledger_entry: db_session.delete(ledger_entry)
    if refund_entry: db_session.delete(refund_entry)
    db_session.commit()


@patch("app.services.payment_factory.PaymentProviderFactory.get_provider")
def test_refund_gateway_failure(
    mock_get_payment_provider, client: TestClient, db_session: Session, seeded_order: Order, manager_token: str
):
    """Test the refund flow when the payment gateway fails to process the refund."""
    os.environ["SENDGRID_API_KEY"] = "test_sendgrid_api_key"
    os.environ["EMAIL_FROM"] = "test-sender@fynlo.com"

    mock_provider_instance = MagicMock()
    async def mock_failed_refund_payment(*args, **kwargs):
        return {
            "success": False,
            "error": "Gateway declined refund",
            "status": "failed",
            "raw_response": {"error_code": "DECLINED", "message": "Insufficient funds in merchant account."}
        }
    mock_provider_instance.refund_payment = MagicMock(side_effect=mock_failed_refund_payment)
    mock_get_payment_provider.return_value = mock_provider_instance

    line_to_refund = seeded_order.items[0]
    refund_payload = {
        "items": [{"line_id": line_to_refund["product_id"], "qty": 1}],
        "reason": "Gateway failure test"
    }

    with patch("app.services.email_service.SendGridAPIClient.send") as mocked_sendgrid_send:
        response = client.post(
            f"/api/v1/orders/{str(seeded_order.id)}/refund",
            json=refund_payload,
            headers={"Authorization": f"Bearer {manager_token}"}
        )

    assert response.status_code == 502
    response_data = response.json()
    assert "Gateway refund failed" in response_data["detail"]

    mocked_sendgrid_send.assert_not_called()

    from app.models.refund import Refund
    refund_entry = db_session.query(Refund).filter(Refund.order_id == str(seeded_order.id)).first()
    assert refund_entry is None

    db_session.refresh(seeded_order)
    assert seeded_order.status == "completed"


# Note: The `seeded_order` fixture needs to ensure the order.items structure
# matches what the refund endpoint and email template expect.
# Specifically, `lineId` in the payload should map to a unique identifier for an order line,
# and the template iterates `order.items` expecting `name`, `qty`, `total_price`/`total`.
# The current seeded_order.items is a list of dicts, ensure product_id is the lineId.
# The email template uses `order.order_number`, `order.items` (list of dicts with name, qty, total), `order.total_amount`.
# The `EmailService.send_receipt` is called with `order=order` (SQLAlchemy Order model).
# The Jinja template will access attributes like `order.order_number`, `order.items`, etc.
# Ensure the SQLAlchemy Order model has these attributes or properties that match.
# The current Order model has `items` as JSONB, so `order.items` will be a list of dicts.
# `order.total_amount` and `order.order_number` are direct columns.
# `order.customer_email` is not a direct column; logic fetches it from related User/Customer.
# The test asserts this fetch works.
