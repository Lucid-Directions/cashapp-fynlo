"""
Tests for WebSocket multi-tenant isolation and real-time features
Ensures WebSocket connections respect tenant boundaries
"""
import pytest
import asyncio
import json
import uuid
from datetime import datetime, timedelta
from websockets import connect, ConnectionClosed
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import User, Restaurant, UserRestaurant, Order
from app.core.auth import create_access_token


class TestWebSocketMultiTenant:
    """Test WebSocket connections with multi-tenant isolation"""

    @pytest.fixture
    async def ws_url(self):
        """Get WebSocket URL for testing"""
        # Assuming WebSocket runs on same port as HTTP API
        return f"ws://localhost:8000/ws"

    @pytest.fixture
    async def restaurant_a(self, db_session: AsyncSession) -> Restaurant:
        """Create test restaurant A"""
        restaurant = Restaurant(
            id=str(uuid.uuid4()),
            name="WebSocket Test Restaurant A",
            email="ws-test-a@restaurant.com",
            phone="+447123456789",
            address="123 WS Test Street",
            city="London",
            postal_code="SW1A 1AA",
            country="UK",
            currency="GBP",
            timezone="Europe/London",
            is_active=True,
            created_at=datetime.utcnow()
        )
        db_session.add(restaurant)
        await db_session.commit()
        return restaurant

    @pytest.fixture
    async def restaurant_b(self, db_session: AsyncSession) -> Restaurant:
        """Create test restaurant B"""
        restaurant = Restaurant(
            id=str(uuid.uuid4()),
            name="WebSocket Test Restaurant B",
            email="ws-test-b@restaurant.com",
            phone="+447123456790",
            address="456 WS Test Avenue",
            city="Manchester",
            postal_code="M1 1AA",
            country="UK",
            currency="GBP",
            timezone="Europe/London",
            is_active=True,
            created_at=datetime.utcnow()
        )
        db_session.add(restaurant)
        await db_session.commit()
        return restaurant

    @pytest.fixture
    async def user_restaurant_a(self, db_session: AsyncSession, restaurant_a: Restaurant) -> User:
        """Create user for restaurant A"""
        user = User(
            id=str(uuid.uuid4()),
            email="user-a@restaurant.com",
            full_name="User A",
            role="manager",
            restaurant_id=restaurant_a.id,
            current_restaurant_id=restaurant_a.id,
            is_active=True,
            created_at=datetime.utcnow()
        )
        db_session.add(user)
        await db_session.commit()
        
        # Create UserRestaurant entry
        user_restaurant = UserRestaurant(
            id=str(uuid.uuid4()),
            user_id=user.id,
            restaurant_id=restaurant_a.id,
            role="manager",
            is_primary=True,
            assigned_at=datetime.utcnow()
        )
        db_session.add(user_restaurant)
        await db_session.commit()
        
        return user

    @pytest.fixture
    async def user_restaurant_b(self, db_session: AsyncSession, restaurant_b: Restaurant) -> User:
        """Create user for restaurant B"""
        user = User(
            id=str(uuid.uuid4()),
            email="user-b@restaurant.com",
            full_name="User B",
            role="manager",
            restaurant_id=restaurant_b.id,
            current_restaurant_id=restaurant_b.id,
            is_active=True,
            created_at=datetime.utcnow()
        )
        db_session.add(user)
        await db_session.commit()
        
        # Create UserRestaurant entry
        user_restaurant = UserRestaurant(
            id=str(uuid.uuid4()),
            user_id=user.id,
            restaurant_id=restaurant_b.id,
            role="manager",
            is_primary=True,
            assigned_at=datetime.utcnow()
        )
        db_session.add(user_restaurant)
        await db_session.commit()
        
        return user

    @pytest.fixture
    async def multi_restaurant_user(self, db_session: AsyncSession, restaurant_a: Restaurant, restaurant_b: Restaurant) -> User:
        """Create user with access to both restaurants (Omega plan)"""
        user = User(
            id=str(uuid.uuid4()),
            email="multi-restaurant@owner.com",
            full_name="Multi Restaurant Owner",
            role="restaurant_owner",
            restaurant_id=restaurant_a.id,
            current_restaurant_id=restaurant_a.id,
            is_active=True,
            subscription_plan="omega",
            created_at=datetime.utcnow()
        )
        db_session.add(user)
        await db_session.commit()
        
        # Create UserRestaurant entries for both restaurants
        for i, restaurant in enumerate([restaurant_a, restaurant_b]):
            user_restaurant = UserRestaurant(
                id=str(uuid.uuid4()),
                user_id=user.id,
                restaurant_id=restaurant.id,
                role="restaurant_owner",
                is_primary=(i == 0),
                assigned_at=datetime.utcnow()
            )
            db_session.add(user_restaurant)
        
        await db_session.commit()
        return user

    def get_ws_token(self, user: User) -> str:
        """Generate WebSocket authentication token"""
        return create_access_token(
            data={
                "sub": user.email,
                "user_id": user.id,
                "restaurant_id": user.restaurant_id,
                "current_restaurant_id": user.current_restaurant_id,
                "role": user.role
            },
            expires_delta=timedelta(minutes=30)
        )

    @pytest.mark.asyncio
    async def test_websocket_tenant_isolation(self, ws_url, user_restaurant_a, user_restaurant_b, db_session):
        """Test that WebSocket connections are isolated by tenant"""
        # Connect as user A
        token_a = self.get_ws_token(user_restaurant_a)
        async with connect(f"{ws_url}?token={token_a}") as ws_a:
            # Subscribe to restaurant A's orders
            await ws_a.send(json.dumps({
                "type": "subscribe",
                "channel": f"restaurant:{user_restaurant_a.restaurant_id}:orders"
            }))
            
            # Connect as user B
            token_b = self.get_ws_token(user_restaurant_b)
            async with connect(f"{ws_url}?token={token_b}") as ws_b:
                # Subscribe to restaurant B's orders
                await ws_b.send(json.dumps({
                    "type": "subscribe",
                    "channel": f"restaurant:{user_restaurant_b.restaurant_id}:orders"
                }))
                
                # Create order in restaurant A
                order_a = Order(
                    id=str(uuid.uuid4()),
                    restaurant_id=user_restaurant_a.restaurant_id,
                    order_number="ORD-A-001",
                    status="pending",
                    total_amount=50.00,
                    created_by=user_restaurant_a.id,
                    created_at=datetime.utcnow()
                )
                db_session.add(order_a)
                await db_session.commit()
                
                # Simulate order update broadcast
                await ws_a.send(json.dumps({
                    "type": "broadcast",
                    "channel": f"restaurant:{user_restaurant_a.restaurant_id}:orders",
                    "data": {
                        "event": "order_created",
                        "order_id": str(order_a.id),
                        "order_number": order_a.order_number
                    }
                }))
                
                # User A should receive the message
                message_a = await asyncio.wait_for(ws_a.recv(), timeout=5.0)
                data_a = json.loads(message_a)
                assert data_a["data"]["order_id"] == str(order_a.id)
                
                # User B should NOT receive the message
                with pytest.raises(asyncio.TimeoutError):
                    await asyncio.wait_for(ws_b.recv(), timeout=2.0)

    @pytest.mark.asyncio
    async def test_websocket_multi_restaurant_switching(self, ws_url, multi_restaurant_user, restaurant_a, restaurant_b):
        """Test WebSocket behavior when user switches restaurants"""
        token = self.get_ws_token(multi_restaurant_user)
        
        async with connect(f"{ws_url}?token={token}") as ws:
            # Initially connected to restaurant A
            await ws.send(json.dumps({
                "type": "subscribe",
                "channel": f"restaurant:{restaurant_a.id}:orders"
            }))
            
            # Switch to restaurant B
            await ws.send(json.dumps({
                "type": "switch_restaurant",
                "restaurant_id": str(restaurant_b.id)
            }))
            
            # Should receive confirmation
            switch_response = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(switch_response)
            assert data["type"] == "restaurant_switched"
            assert data["restaurant_id"] == str(restaurant_b.id)
            
            # Previous subscriptions should be cleared
            # New subscriptions should be for restaurant B
            await ws.send(json.dumps({
                "type": "subscribe",
                "channel": f"restaurant:{restaurant_b.id}:orders"
            }))

    @pytest.mark.asyncio
    async def test_websocket_unauthorized_channel_access(self, ws_url, user_restaurant_a, restaurant_b):
        """Test that users cannot subscribe to unauthorized channels"""
        token = self.get_ws_token(user_restaurant_a)
        
        async with connect(f"{ws_url}?token={token}") as ws:
            # Try to subscribe to restaurant B's channel (unauthorized)
            await ws.send(json.dumps({
                "type": "subscribe",
                "channel": f"restaurant:{restaurant_b.id}:orders"
            }))
            
            # Should receive error response
            response = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(response)
            assert data["type"] == "error"
            assert "unauthorized" in data["message"].lower()

    @pytest.mark.asyncio
    async def test_websocket_heartbeat_with_tenant_context(self, ws_url, user_restaurant_a):
        """Test WebSocket heartbeat maintains tenant context"""
        token = self.get_ws_token(user_restaurant_a)
        
        async with connect(f"{ws_url}?token={token}") as ws:
            # Send heartbeat
            await ws.send(json.dumps({
                "type": "ping",
                "timestamp": datetime.utcnow().isoformat()
            }))
            
            # Should receive pong with tenant context
            pong = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(pong)
            assert data["type"] == "pong"
            assert data["restaurant_id"] == str(user_restaurant_a.restaurant_id)

    @pytest.mark.asyncio
    async def test_websocket_concurrent_multi_tenant_broadcasts(self, ws_url, user_restaurant_a, user_restaurant_b, db_session):
        """Test concurrent broadcasts to different tenants"""
        # Connect multiple users from each restaurant
        connections = []
        
        # 2 users from restaurant A
        for i in range(2):
            user = User(
                id=str(uuid.uuid4()),
                email=f"user-a-{i}@restaurant.com",
                full_name=f"User A{i}",
                role="employee",
                restaurant_id=user_restaurant_a.restaurant_id,
                current_restaurant_id=user_restaurant_a.restaurant_id,
                is_active=True,
                created_at=datetime.utcnow()
            )
            db_session.add(user)
            await db_session.commit()
            
            token = self.get_ws_token(user)
            ws = await connect(f"{ws_url}?token={token}").__aenter__()
            await ws.send(json.dumps({
                "type": "subscribe",
                "channel": f"restaurant:{user.restaurant_id}:orders"
            }))
            connections.append(("A", ws))
        
        # 2 users from restaurant B
        for i in range(2):
            user = User(
                id=str(uuid.uuid4()),
                email=f"user-b-{i}@restaurant.com",
                full_name=f"User B{i}",
                role="employee",
                restaurant_id=user_restaurant_b.restaurant_id,
                current_restaurant_id=user_restaurant_b.restaurant_id,
                is_active=True,
                created_at=datetime.utcnow()
            )
            db_session.add(user)
            await db_session.commit()
            
            token = self.get_ws_token(user)
            ws = await connect(f"{ws_url}?token={token}").__aenter__()
            await ws.send(json.dumps({
                "type": "subscribe",
                "channel": f"restaurant:{user.restaurant_id}:orders"
            }))
            connections.append(("B", ws))
        
        # Broadcast to restaurant A
        broadcast_a = {
            "type": "broadcast",
            "channel": f"restaurant:{user_restaurant_a.restaurant_id}:orders",
            "data": {"event": "test_a", "value": "Restaurant A Event"}
        }
        
        # Broadcast to restaurant B
        broadcast_b = {
            "type": "broadcast",
            "channel": f"restaurant:{user_restaurant_b.restaurant_id}:orders",
            "data": {"event": "test_b", "value": "Restaurant B Event"}
        }
        
        # Send broadcasts
        await connections[0][1].send(json.dumps(broadcast_a))
        await connections[2][1].send(json.dumps(broadcast_b))
        
        # Verify correct delivery
        results = []
        for restaurant, ws in connections:
            try:
                message = await asyncio.wait_for(ws.recv(), timeout=2.0)
                data = json.loads(message)
                results.append((restaurant, data["data"]["event"]))
            except asyncio.TimeoutError:
                results.append((restaurant, None))
        
        # Restaurant A users should only receive restaurant A events
        assert results[0] == ("A", "test_a")
        assert results[1] == ("A", "test_a")
        
        # Restaurant B users should only receive restaurant B events
        assert results[2] == ("B", "test_b")
        assert results[3] == ("B", "test_b")
        
        # Cleanup
        for _, ws in connections:
            await ws.close()

    @pytest.mark.asyncio
    async def test_websocket_token_expiry_handling(self, ws_url, user_restaurant_a):
        """Test WebSocket behavior with expired tokens"""
        # Create token with very short expiry
        expired_token = create_access_token(
            data={
                "sub": user_restaurant_a.email,
                "user_id": user_restaurant_a.id,
                "restaurant_id": user_restaurant_a.restaurant_id,
                "role": user_restaurant_a.role
            },
            expires_delta=timedelta(seconds=1)
        )
        
        # Wait for token to expire
        await asyncio.sleep(2)
        
        # Try to connect with expired token
        with pytest.raises(ConnectionClosed):
            async with connect(f"{ws_url}?token={expired_token}") as ws:
                await ws.send(json.dumps({"type": "ping"}))

    @pytest.mark.asyncio
    async def test_websocket_platform_owner_access(self, ws_url, test_platform_owner, restaurant_a, restaurant_b):
        """Test that platform owners can monitor all restaurants"""
        token = self.get_ws_token(test_platform_owner)
        
        async with connect(f"{ws_url}?token={token}") as ws:
            # Platform owner should be able to subscribe to any restaurant
            await ws.send(json.dumps({
                "type": "subscribe",
                "channel": f"restaurant:{restaurant_a.id}:orders"
            }))
            
            await ws.send(json.dumps({
                "type": "subscribe",
                "channel": f"restaurant:{restaurant_b.id}:orders"
            }))
            
            # Should also be able to subscribe to platform-wide events
            await ws.send(json.dumps({
                "type": "subscribe",
                "channel": "platform:alerts"
            }))
            
            # No errors expected
            await asyncio.sleep(1)  # Give time for any error responses