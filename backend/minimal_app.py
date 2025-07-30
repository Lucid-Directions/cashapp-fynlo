"""
Minimal FastAPI server to get essential endpoints working
This bypasses complex payment provider imports and focuses on core data endpoints
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import json
from datetime import datetime
from app.core.exceptions import ResourceNotFoundException
app = FastAPI(title='Fynlo POS API - Minimal', description='Essential API endpoints for Fynlo POS mobile app', version='1.0.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
MOCK_EMPLOYEES = [{'id': 1, 'name': 'Maria Garcia', 'firstName': 'Maria', 'lastName': 'Garcia', 'role': 'server', 'email': 'maria.garcia@casaestrella.com', 'phone': '+44 7700 900001', 'hourlyRate': 12.5, 'hoursWorked': 38, 'isActive': True, 'hireDate': '2023-01-15'}, {'id': 2, 'name': 'Jose Rodriguez', 'firstName': 'Jose', 'lastName': 'Rodriguez', 'role': 'chef', 'email': 'jose.rodriguez@casaestrella.com', 'phone': '+44 7700 900002', 'hourlyRate': 18.0, 'hoursWorked': 42, 'isActive': True, 'hireDate': '2022-08-20'}, {'id': 3, 'name': 'Ana Martinez', 'firstName': 'Ana', 'lastName': 'Martinez', 'role': 'bartender', 'email': 'ana.martinez@casaestrella.com', 'phone': '+44 7700 900003', 'hourlyRate': 14.0, 'hoursWorked': 35, 'isActive': True, 'hireDate': '2023-03-10'}, {'id': 4, 'name': 'Carlos Lopez', 'firstName': 'Carlos', 'lastName': 'Lopez', 'role': 'server', 'email': 'carlos.lopez@casaestrella.com', 'phone': '+44 7700 900004', 'hourlyRate': 12.5, 'hoursWorked': 32, 'isActive': True, 'hireDate': '2023-06-01'}, {'id': 5, 'name': 'Sofia Hernandez', 'firstName': 'Sofia', 'lastName': 'Hernandez', 'role': 'cashier', 'email': 'sofia.hernandez@casaestrella.com', 'phone': '+44 7700 900005', 'hourlyRate': 11.5, 'hoursWorked': 40, 'isActive': True, 'hireDate': '2023-04-15'}]
MOCK_INVENTORY = [{'id': 1, 'sku': 'BEEF-001', 'name': 'Ground Beef', 'category': 'Meat', 'currentStock': 25.5, 'unit': 'kg', 'minThreshold': 10, 'maxThreshold': 50, 'costPerUnit': 8.5, 'supplier': 'Premium Meats Ltd', 'lastRestocked': '2025-07-01', 'status': 'in_stock'}, {'id': 2, 'sku': 'CHICK-001', 'name': 'Chicken Breast', 'category': 'Meat', 'currentStock': 18.2, 'unit': 'kg', 'minThreshold': 15, 'maxThreshold': 40, 'costPerUnit': 6.75, 'supplier': 'Premium Meats Ltd', 'lastRestocked': '2025-06-30', 'status': 'in_stock'}]
MOCK_ORDERS = [{'id': 1, 'name': 'Order #001', 'date_order': '2025-07-03T10:30:00Z', 'state': 'paid', 'amount_total': 24.5, 'partner_name': 'Table 5', 'session_id': 1, 'lines': [{'id': 1, 'product_name': 'Chicken Tacos', 'qty': 2, 'price_unit': 8.5, 'price_subtotal': 17.0}]}]
MOCK_ANALYTICS = {'todaySummary': {'totalSales': 2847.5, 'transactions': 127, 'averageOrder': 22.42, 'totalRevenue': 2847.5, 'totalOrders': 127, 'averageOrderValue': 22.42}, 'weeklyLabor': {'totalActualHours': 248, 'totalLaborCost': 3720.0, 'efficiency': 87.5, 'scheduledHours': 280, 'overtimeHours': 8}, 'topItemsToday': [{'name': 'Chicken Tacos', 'quantity': 45, 'revenue': 675.0}, {'name': 'Beef Burrito', 'quantity': 38, 'revenue': 570.0}, {'name': 'Churros', 'quantity': 32, 'revenue': 192.0}, {'name': 'Margarita', 'quantity': 28, 'revenue': 336.0}, {'name': 'Quesadilla', 'quantity': 25, 'revenue': 375.0}], 'topPerformersToday': [{'name': 'Maria Garcia', 'role': 'Server', 'orders': 18, 'sales': 425.5}, {'name': 'Jose Rodriguez', 'role': 'Chef', 'orders': 16, 'sales': 398.25}, {'name': 'Ana Martinez', 'role': 'Bartender', 'orders': 12, 'sales': 286.75}, {'name': 'Carlos Lopez', 'role': 'Server', 'orders': 14, 'sales': 315.8}, {'name': 'Sofia Hernandez', 'role': 'Cashier', 'orders': 11, 'sales': 267.9}], 'salesTrend': [{'period': 'Mon', 'sales': 1850.25}, {'period': 'Tue', 'sales': 2124.5}, {'period': 'Wed', 'sales': 1976.75}, {'period': 'Thu', 'sales': 2398.0}, {'period': 'Fri', 'sales': 3247.5}, {'period': 'Sat', 'sales': 3856.25}, {'period': 'Sun', 'sales': 2847.5}]}

def success_response(data: Any, message: str='Success') -> Dict[str, Any]:
    """Standard success response format"""
    return {'success': True, 'message': message, 'data': data, 'timestamp': datetime.now().isoformat()}

def error_response(message: str, status_code: int=400) -> Dict[str, Any]:
    """Standard error response format"""
    return {'success': False, 'message': message, 'data': None, 'timestamp': datetime.now().isoformat()}

@app.get('/health')
def health_check():
    return {'status': 'healthy', 'service': 'fynlo-pos-api', 'timestamp': datetime.now().isoformat()}

@app.get('/api/v1/employees')
def get_employees():
    return success_response(MOCK_EMPLOYEES, 'Employees retrieved successfully')

@app.get('/api/v1/employees/{employee_id}')
def get_employee(employee_id: int):
    employee = next((emp for emp in MOCK_EMPLOYEES if emp['id'] == employee_id), None)
    if not employee:
        raise ResourceNotFoundException(message='Employee not found', code='NOT_FOUND', resource_type='employee')
    return success_response(employee, 'Employee retrieved successfully')

@app.get('/api/v1/inventory')
def get_inventory():
    return success_response(MOCK_INVENTORY, 'Inventory retrieved successfully')

@app.get('/api/v1/orders/recent')
def get_recent_orders(limit: int=20):
    return success_response(MOCK_ORDERS[:limit], 'Recent orders retrieved successfully')

@app.get('/api/v1/analytics/dashboard')
def get_analytics_dashboard():
    return success_response(MOCK_ANALYTICS, 'Analytics dashboard data retrieved successfully')

@app.get('/api/v1/reports/dashboard')
def get_reports_dashboard():
    """Alias for analytics dashboard for reports screen"""
    return success_response(MOCK_ANALYTICS, 'Reports dashboard data retrieved successfully')

@app.get('/api/v1/categories')
def get_categories():
    categories = [{'id': 1, 'name': 'Main Dishes', 'active': True}, {'id': 2, 'name': 'Appetizers', 'active': True}, {'id': 3, 'name': 'Beverages', 'active': True}, {'id': 4, 'name': 'Desserts', 'active': True}]
    return success_response(categories, 'Categories retrieved successfully')

@app.get('/api/v1/products/mobile')
def get_products_mobile():
    products = [{'id': 1, 'name': 'Chicken Tacos', 'price': 8.5, 'category': 'Main Dishes', 'available_in_pos': True, 'active': True}, {'id': 2, 'name': 'Beef Burrito', 'price': 12.0, 'category': 'Main Dishes', 'available_in_pos': True, 'active': True}]
    return success_response(products, 'Products retrieved successfully')
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)