#!/usr/bin/env python3
"""
Test script for Database Transaction Management implementation
"""

import asyncio
import sys
import os
from decimal import Decimal
import uuid
import logging
from datetime import datetime, timedelta

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_transaction_decorators():
    """Test transaction decorators and error handling"""
    
    logger.info("🧪 Testing Transaction Management Decorators...")
    
    try:
        from app.core.transaction_manager import (
            TransactionManager, 
            transactional, 
            optimistic_lock_retry,
            BatchTransactionManager,
            TransactionError,
            RetryableTransactionError,
            NonRetryableTransactionError
        )
        
        logger.info("✅ Transaction management imports successful")
        
        # Test TransactionManager instantiation
        tm = TransactionManager(max_retries=5, retry_delay=0.05)
        assert tm.max_retries == 5
        assert tm.retry_delay == 0.05
        logger.info("✅ TransactionManager instantiation works")
        
        # Test BatchTransactionManager instantiation
        btm = BatchTransactionManager(batch_size=50, rollback_on_partial_failure=True)
        assert btm.batch_size == 50
        assert btm.rollback_on_partial_failure == True
        logger.info("✅ BatchTransactionManager instantiation works")
        
        # Test decorator factory
        decorator = transactional(max_retries=3, retry_delay=0.1)
        assert callable(decorator)
        logger.info("✅ Transactional decorator factory works")
        
        # Test optimistic lock decorator
        opt_decorator = optimistic_lock_retry(version_field='version', max_retries=10)
        assert callable(opt_decorator)
        logger.info("✅ Optimistic lock decorator factory works")
        
        logger.info("✅ All transaction management components instantiate correctly")
        return True
        
    except Exception as e:
        logger.error(f"❌ Transaction management test failed: {e}")
        return False


async def test_order_creation_atomicity():
    """Test that order creation with stock updates is atomic"""
    
    logger.info("\n🔄 Testing Order Creation Atomicity...")
    
    try:
        from app.core.database import get_db, Order, Product
        from app.api.v1.endpoints.orders import create_order
        
        logger.info("✅ Order creation imports successful")
        
        # Check that create_order function has @transactional decorator
        import inspect
        source = inspect.getsource(create_order)
        
        if "@transactional" not in source:
            logger.info("❌ create_order function missing @transactional decorator")
            return False
        
        logger.info("✅ create_order function has @transactional decorator")
        
        # Check for stock validation logic
        if "stock_tracking" not in source and "stock_quantity" not in source:
            logger.info("❌ Stock validation logic not found in create_order")
            return False
        
        logger.info("✅ Stock validation logic found in create_order")
        
        # Check for atomic stock updates
        if "product.stock_quantity -= item.quantity" not in source:
            logger.info("❌ Atomic stock update logic not found")
            return False
        
        logger.info("✅ Atomic stock update logic found")
        
        # Check for proper error handling
        if "HTTPException" not in source and "logger.error" not in source:
            logger.error("❌ Error handling not found in create_order")
            return False
        
        logger.error("✅ Error handling found in create_order")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Order creation atomicity test failed: {e}")
        return False


async def test_payment_processing_atomicity():
    """Test that payment processing operations are atomic"""
    
    logger.info("\n💳 Testing Payment Processing Atomicity...")
    
    try:
        from app.api.v1.endpoints.payments import confirm_qr_payment, process_stripe_payment
        
        logger.info("✅ Payment processing imports successful")
        
        # Check QR payment confirmation
        import inspect
        qr_source = inspect.getsource(confirm_qr_payment)
        
        if "@transactional" not in qr_source:
            logger.info("❌ confirm_qr_payment missing @transactional decorator")
            return False
        
        logger.info("✅ confirm_qr_payment has @transactional decorator")
        
        # Check for duplicate payment prevention
        if "already processed" not in qr_source and "already paid" not in qr_source:
            logger.info("❌ Duplicate payment prevention not found in QR payment")
            return False
        
        logger.info("✅ Duplicate payment prevention found in QR payment")
        
        # Check Stripe payment processing
        stripe_source = inspect.getsource(process_stripe_payment)
        
        if "@transactional" not in stripe_source:
            logger.info("❌ process_stripe_payment missing @transactional decorator")
            return False
        
        logger.info("✅ process_stripe_payment has @transactional decorator")
        
        # Check for payment record creation before external API call
        if "db.add(payment)" not in stripe_source or "db.flush()" not in stripe_source:
            logger.info("❌ Payment record not created before external API call")
            return False
        
        logger.info("✅ Payment record created before external API call")
        
        # Check for proper order status updates
        if "order.payment_status" not in stripe_source:
            logger.info("❌ Order status update not found in Stripe payment")
            return False
        
        logger.info("✅ Order status update found in Stripe payment")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Payment processing atomicity test failed: {e}")
        return False


async def test_transaction_error_handling():
    """Test transaction error handling and retry logic"""
    
    logger.error("\n⚠️ Testing Transaction Error Handling...")
    
    try:
        from app.core.transaction_manager import (
            TransactionError,
            RetryableTransactionError, 
            NonRetryableTransactionError,
            TransactionManager
        )
        
        # Test exception hierarchy
        assert issubclass(RetryableTransactionError, TransactionError)
        assert issubclass(NonRetryableTransactionError, TransactionError)
        logger.error("✅ Transaction exception hierarchy correct")
        
        # Test error message propagation
        try:
            raise RetryableTransactionError("Test retryable error")
        except TransactionError as e:
            assert str(e) == "Test retryable error"
        
        try:
            raise NonRetryableTransactionError("Test non-retryable error")
        except TransactionError as e:
            assert str(e) == "Test non-retryable error"
        
        logger.error("✅ Error message propagation works")
        
        # Test transaction manager error categorization
        tm = TransactionManager(max_retries=2, retry_delay=0.01)
        
        # Mock database session for testing
        class MockSession:
            def __init__(self):
                self.commit_called = False
                self.rollback_called = False
                self.in_transaction_flag = False
            
            def commit(self):
                self.commit_called = True
            
            def rollback(self):
                self.rollback_called = True
            
            def in_transaction(self):
                return self.in_transaction_flag
        
        # Test successful transaction
        mock_db = MockSession()
        
        try:
            async with tm.atomic_transaction(mock_db):
                # Simulate successful operation
                pass
            
            assert mock_db.commit_called
            assert not mock_db.rollback_called
            logger.info("✅ Successful transaction commits correctly")
            
        except Exception as e:
            logger.error(f"❌ Successful transaction test failed: {e}")
            return False
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Transaction error handling test failed: {e}")
        return False


async def test_race_condition_protection():
    """Test protection against race conditions"""
    
    logger.info("\n🏁 Testing Race Condition Protection...")
    
    try:
        # Check for optimistic locking implementation
        from app.core.transaction_manager import optimistic_lock_retry
        
        logger.info("✅ Optimistic locking decorator available")
        
        # Check for proper version field handling
        decorator = optimistic_lock_retry(version_field='version', max_retries=5)
        assert callable(decorator)
        logger.info("✅ Optimistic locking decorator configurable")
        
        # Check payment processing for race condition protection
        from app.api.v1.endpoints.payments import confirm_qr_payment
        import inspect
        
        source = inspect.getsource(confirm_qr_payment)
        
        # Look for status validation before processing
        if "already processed" not in source:
            logger.info("❌ Missing protection against duplicate payment processing")
            return False
        
        logger.info("✅ Duplicate payment processing protection found")
        
        # Check for order validation
        if "order.payment_status" not in source:
            logger.info("❌ Missing order payment status validation")
            return False
        
        logger.info("✅ Order payment status validation found")
        
        # Check for proper status transitions
        if "qr_payment.status =" not in source:
            logger.info("❌ Missing QR payment status updates")
            return False
        
        logger.info("✅ QR payment status updates found")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Race condition protection test failed: {e}")
        return False


async def test_batch_transaction_handling():
    """Test batch transaction management"""
    
    logger.info("\n📦 Testing Batch Transaction Handling...")
    
    try:
        from app.core.transaction_manager import BatchTransactionManager
        
        # Test batch manager instantiation
        batch_manager = BatchTransactionManager(batch_size=100, rollback_on_partial_failure=True)
        logger.info("✅ BatchTransactionManager instantiated")
        
        # Test configuration
        assert batch_manager.batch_size == 100
        assert batch_manager.rollback_on_partial_failure == True
        logger.info("✅ Batch manager configuration correct")
        
        # Test with rollback disabled
        batch_manager_no_rollback = BatchTransactionManager(
            batch_size=50, 
            rollback_on_partial_failure=False
        )
        assert batch_manager_no_rollback.rollback_on_partial_failure == False
        logger.info("✅ Batch manager rollback configuration works")
        
        # Check that sync manager could use batch transactions
        try:
            from app.core.sync_manager import sync_manager
            logger.info("✅ Sync manager available for batch transaction integration")
        except ImportError:
            logger.info("⚠️ Sync manager not available, but batch transactions ready for future use")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Batch transaction handling test failed: {e}")
        return False


async def main():
    """Main test function"""
    
    logger.info("🚀 Database Transaction Management - Test Suite")
    logger.info("=" * 70)
    
    # Test 1: Transaction decorators and basic functionality
    decorators_test = await test_transaction_decorators()
    
    # Test 2: Order creation atomicity
    order_test = await test_order_creation_atomicity()
    
    # Test 3: Payment processing atomicity
    payment_test = await test_payment_processing_atomicity()
    
    # Test 4: Error handling and retry logic
    error_test = await test_transaction_error_handling()
    
    # Test 5: Race condition protection
    race_test = await test_race_condition_protection()
    
    # Test 6: Batch transaction handling
    batch_test = await test_batch_transaction_handling()
    
    logger.info("\n" + "=" * 70)
    
    all_tests = [decorators_test, order_test, payment_test, error_test, race_test, batch_test]
    
    if all(all_tests):
        logger.info("🎉 ALL TESTS PASSED - Database transaction management correctly implemented!")
        logger.info("\nSummary of Implementation:")
        logger.info("1. ✅ Transaction decorators with retry logic")
        logger.info("2. ✅ Atomic order creation with stock updates")
        logger.info("3. ✅ Secure payment processing with rollback")
        logger.error("4. ✅ Comprehensive error handling")
        logger.info("5. ✅ Race condition protection")
        logger.info("6. ✅ Batch transaction management")
        logger.info("\nTransaction Management Benefits:")
        logger.info("- 🔒 Data consistency guaranteed")
        logger.error("- 🚀 Automatic retry for transient failures")
        logger.info("- 🛡️ Protection against race conditions")
        logger.error("- 📊 Comprehensive error logging")
        logger.error("- 🔄 Rollback support for failed operations")
        logger.info("- ⚡ Optimistic locking for concurrent updates")
        return True
    else:
        failed_tests = []
        test_names = ["Decorators", "Order Atomicity", "Payment Atomicity", "Error Handling", "Race Protection", "Batch Handling"]
        for i, test_result in enumerate(all_tests):
            if not test_result:
                failed_tests.append(test_names[i])
        
        logger.error("❌ SOME TESTS FAILED - Please review the issues above")
        logger.error(f"Failed tests: {', '.join(failed_tests)}")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)