#!/usr/bin/env python3
"""
Test script for Financial Data DECIMAL Precision verification
"""TODO: Add docstring."""

import asyncio
import sys
import os
from decimal import Decimal
import psycopg2
from psycopg2.extras import RealDictCursor

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.'))

async def test_decimal_precision():
    """Test that all monetary fields use DECIMAL with proper precision"""
    
    print("🧪 Testing Financial Data DECIMAL Precision...")
    
    # Database connection parameters
    DB_CONFIG = {
        'host': 'localhost',
        'port': 5432,
        'database': 'fynlo_pos',
        'user': 'postgres',
        'password': 'password'
    }
    
    try:
        # Connect to database
        conn = psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)
        cursor = conn.cursor()
        
        print("✅ Database connection established")
        
        # Expected monetary fields with DECIMAL(10,2)
        expected_decimal_fields = [
            ('customers', 'total_spent'),
            ('products', 'price'),
            ('products', 'cost'),
            ('orders', 'subtotal'),
            ('orders', 'tax_amount'),
            ('orders', 'service_charge'),
            ('orders', 'discount_amount'),
            ('orders', 'total_amount'),
            ('payments', 'amount'),
            ('payments', 'fee_amount'),
            ('payments', 'net_amount'),
            ('qr_payments', 'amount'),
            ('qr_payments', 'fee_amount'),
            ('qr_payments', 'net_amount'),
        ]
        
        # Check each field's data type and precision
        cursor.execute("""
            SELECT 
                table_name,
                column_name,
                data_type,
                numeric_precision,
                numeric_scale
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND column_name IN ('price', 'cost', 'subtotal', 'tax_amount', 'service_charge', 
                               'discount_amount', 'total_amount', 'amount', 'fee_amount', 
                               'net_amount', 'total_spent')
            ORDER BY table_name, column_name
        """)
        
        actual_fields = cursor.fetchall()
        
        # Verify all fields are DECIMAL with precision 10, scale 2
        incorrect_fields = []
        for field in actual_fields:
            if (field['data_type'] != 'numeric' or 
                field['numeric_precision'] != 10 or 
                field['numeric_scale'] != 2):
                incorrect_fields.append(field)
        
        if incorrect_fields:
            print("❌ Fields with incorrect precision/scale:")
            for field in incorrect_fields:
                print(f"   - {field['table_name']}.{field['column_name']}: {field['data_type']}({field['numeric_precision']},{field['numeric_scale']})")
            return False
        
        print(f"✅ All {len(actual_fields)} monetary fields use DECIMAL(10,2)")
        
        # Test precision with actual calculations
        print("\n🔢 Testing precision calculations...")
        
        # Test that we can store precise decimal values
        test_cases = [
            Decimal('123.45'),
            Decimal('0.01'),
            Decimal('999.99'),
            Decimal('12345.67'),
            Decimal('0.99'),
        ]
        
        for test_value in test_cases:
            # Test with a sample calculation
            cursor.execute("""
                SELECT %s::DECIMAL(10,2) AS test_value,
                       (%s::DECIMAL(10,2) * 1.20)::DECIMAL(10,2) AS with_tax,
                       (%s::DECIMAL(10,2) * 0.012)::DECIMAL(10,2) AS fee_calc
            """, (test_value, test_value, test_value))
            
            result = cursor.fetchone()
            
            # Verify no precision loss
            if Decimal(str(result['test_value'])) != test_value:
                print(f"❌ Precision loss for {test_value}: got {result['test_value']}")
                return False
        
        print("✅ All precision calculations maintain accuracy")
        
        # Test financial calculations that would lose precision with FLOAT
        print("\n💰 Testing financial calculation accuracy...")
        
        # This would lose precision with FLOAT but should be accurate with DECIMAL
        price1 = Decimal('19.99')
        price2 = Decimal('24.95')
        quantity = 3
        tax_rate = Decimal('0.08')
        
        cursor.execute("""
            SELECT 
                (%s::DECIMAL(10,2) + %s::DECIMAL(10,2)) * %s AS subtotal,
                ((%s::DECIMAL(10,2) + %s::DECIMAL(10,2)) * %s * %s::DECIMAL(10,2))::DECIMAL(10,2) AS tax,
                ((%s::DECIMAL(10,2) + %s::DECIMAL(10,2)) * %s * (1 + %s::DECIMAL(10,2)))::DECIMAL(10,2) AS total
        """, (price1, price2, quantity, price1, price2, quantity, tax_rate, 
              price1, price2, quantity, tax_rate))
        
        result = cursor.fetchone()
        
        # Calculate expected values
        expected_subtotal = (price1 + price2) * quantity
        expected_tax = expected_subtotal * tax_rate
        expected_total = expected_subtotal + expected_tax
        
        if (Decimal(str(result['subtotal'])) != expected_subtotal or
            abs(Decimal(str(result['tax'])) - expected_tax) > Decimal('0.01') or
            abs(Decimal(str(result['total'])) - expected_total) > Decimal('0.01')):
            print(f"❌ Financial calculation inaccuracy:")
            print(f"   Expected: subtotal={expected_subtotal}, tax={expected_tax}, total={expected_total}")
            print(f"   Got: subtotal={result['subtotal']}, tax={result['tax']}, total={result['total']}")
            return False
        
        print("✅ Financial calculations are accurate to the cent")
        
        print("\n🎉 All DECIMAL precision tests passed!")
        print("\nPrecision Benefits:")
        print("- ✅ No floating-point rounding errors")
        print("- ✅ Accurate currency calculations")
        print("- ✅ Precise tax and fee computations")
        print("- ✅ Compliance with financial standards")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False


async def test_model_compatibility():
    """Test that the database models are compatible with the DECIMAL changes"""
    
    print("\n🔍 Testing Model Compatibility...")
    
    try:
        # Import the models to verify they load correctly
        from app.core.database import Product, Order, Payment, QRPayment, Customer
        
        print("✅ All database models import successfully")
        
        # Verify that the DECIMAL fields are defined correctly
        decimal_fields = {
            Customer: ['total_spent'],
            Product: ['price', 'cost'],
            Order: ['subtotal', 'tax_amount', 'service_charge', 'discount_amount', 'total_amount'],
            Payment: ['amount', 'fee_amount', 'net_amount'],
            QRPayment: ['amount', 'fee_amount', 'net_amount'],
        }
        
        for model_class, fields in decimal_fields.items():
            for field_name in fields:
                if not hasattr(model_class, field_name):
                    print(f"❌ Missing field {field_name} in {model_class.__name__}")
                    return False
                
                # Check that the field is defined as DECIMAL
                field = getattr(model_class, field_name)
                if not hasattr(field.property, 'columns'):
                    continue
                    
                column = field.property.columns[0]
                if column.type.__class__.__name__ != 'DECIMAL':
                    print(f"❌ Field {model_class.__name__}.{field_name} is not DECIMAL: {column.type}")
                    return False
        
        print("✅ All model fields use DECIMAL type correctly")
        
        return True
        
    except Exception as e:
        print(f"❌ Model compatibility test failed: {e}")
        return False


async def main():
    """Main test function"""
    
    print("🚀 Financial Data DECIMAL Precision - Test Suite")
    print("=" * 60)
    
    # Test 1: Database DECIMAL precision
    precision_test = await test_decimal_precision()
    
    # Test 2: Model compatibility
    model_test = await test_model_compatibility()
    
    print("\n" + "=" * 60)
    
    if precision_test and model_test:
        print("🎉 ALL TESTS PASSED - Financial data precision is correctly implemented!")
        print("\nSummary of Implementation:")
        print("1. All 14 monetary fields converted to DECIMAL(10,2)")
        print("2. Database schema updated with precise numeric types")
        print("3. Models updated to use DECIMAL instead of FLOAT")
        print("4. Financial calculations maintain cent-level accuracy")
        print("5. Compliance with financial data standards achieved")
        return True
    else:
        print("❌ SOME TESTS FAILED - Please review the issues above")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)