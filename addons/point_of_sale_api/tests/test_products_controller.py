import json
import unittest
from unittest.mock import patch, MagicMock

from odoo.tests.common import TransactionCase
from odoo.exceptions import ValidationError, AccessDenied
from odoo.addons.point_of_sale_api.controllers.products import ProductsController


class TestProductsController(TransactionCase):
    """Test cases for ProductsController endpoints"""

    def setUp(self):
        super().setUp()
        self.controller = ProductsController()
        
        # Create test user with POS access
        self.test_user = self.env['res.users'].create({
            'name': 'Test POS User',
            'login': 'test_pos_user',
            'email': 'test@example.com',
            'groups_id': [(6, 0, [self.env.ref('point_of_sale.group_pos_user').id])]
        })
        
        # Create test category
        self.test_category = self.env['pos.category'].create({
            'name': 'Test Category',
            'sequence': 1
        })
        
        # Create test products
        self.test_product1 = self.env['product.product'].create({
            'name': 'Test Pizza',
            'default_code': 'PIZZA001',
            'barcode': '1234567890123',
            'list_price': 15.99,
            'standard_price': 8.50,
            'available_in_pos': True,
            'active': True,
            'sale_ok': True,
            'pos_categ_id': self.test_category.id,
        })
        
        self.test_product2 = self.env['product.product'].create({
            'name': 'Test Burger',
            'default_code': 'BURGER001',
            'barcode': '1234567890124',
            'list_price': 12.99,
            'standard_price': 6.50,
            'available_in_pos': True,
            'active': True,
            'sale_ok': True,
            'pos_categ_id': self.test_category.id,
        })

    @patch('odoo.http.request')
    def test_get_products_success(self, mock_request):
        """Test successful products retrieval"""
        # Mock request parameters
        mock_request.httprequest.args.get.side_effect = lambda key, default=None: {
            'limit': '50',
            'offset': '0',
            'category_id': None,
            'search': None
        }.get(key, default)
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.order.read']
        }
        
        # Call endpoint
        response = self.controller.get_products(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertIn('products', response_data['data'])
        self.assertIn('pagination', response_data['data'])
        self.assertGreaterEqual(len(response_data['data']['products']), 2)

    @patch('odoo.http.request')
    def test_get_products_with_category_filter(self, mock_request):
        """Test products retrieval with category filter"""
        # Mock request parameters
        mock_request.httprequest.args.get.side_effect = lambda key, default=None: {
            'limit': '50',
            'offset': '0',
            'category_id': str(self.test_category.id),
            'search': None
        }.get(key, default)
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.order.read']
        }
        
        # Call endpoint
        response = self.controller.get_products(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        products = response_data['data']['products']
        for product in products:
            self.assertEqual(product['category_id'], self.test_category.id)

    @patch('odoo.http.request')
    def test_get_products_with_search(self, mock_request):
        """Test products retrieval with search"""
        # Mock request parameters
        mock_request.httprequest.args.get.side_effect = lambda key, default=None: {
            'limit': '50',
            'offset': '0',
            'category_id': None,
            'search': 'pizza'
        }.get(key, default)
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.order.read']
        }
        
        # Call endpoint
        response = self.controller.get_products(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        products = response_data['data']['products']
        # Should find the pizza product
        pizza_found = any('pizza' in product['name'].lower() for product in products)
        self.assertTrue(pizza_found)

    @patch('odoo.http.request')
    def test_get_product_by_id_success(self, mock_request):
        """Test successful product retrieval by ID"""
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.order.read']
        }
        
        # Call endpoint
        response = self.controller.get_product(self.test_product1.id, auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertEqual(response_data['data']['id'], self.test_product1.id)
        self.assertEqual(response_data['data']['name'], 'Test Pizza')

    @patch('odoo.http.request')
    def test_get_product_by_id_not_found(self, mock_request):
        """Test product retrieval with non-existent ID"""
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.order.read']
        }
        
        # Call endpoint with non-existent ID
        response = self.controller.get_product(99999, auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertFalse(response_data['success'])
        self.assertEqual(response.status_code, 404)

    @patch('odoo.http.request')
    def test_get_product_by_barcode_success(self, mock_request):
        """Test successful product retrieval by barcode"""
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.order.read']
        }
        
        # Call endpoint
        response = self.controller.get_product_by_barcode('1234567890123', auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertEqual(response_data['data']['barcode'], '1234567890123')
        self.assertEqual(response_data['data']['name'], 'Test Pizza')

    @patch('odoo.http.request')
    def test_get_product_by_barcode_not_found(self, mock_request):
        """Test product retrieval with non-existent barcode"""
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.order.read']
        }
        
        # Call endpoint with non-existent barcode
        response = self.controller.get_product_by_barcode('9999999999999', auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertFalse(response_data['success'])
        self.assertEqual(response.status_code, 404)

    @patch('odoo.http.request')
    def test_search_products_success(self, mock_request):
        """Test successful product search"""
        # Mock request data
        mock_request.httprequest.get_json.return_value = {
            'query': 'test',
            'limit': 20,
            'offset': 0
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.order.read']
        }
        
        # Call endpoint
        response = self.controller.search_products(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertIn('products', response_data['data'])
        self.assertEqual(response_data['data']['query'], 'test')

    @patch('odoo.http.request')
    def test_search_products_with_filters(self, mock_request):
        """Test product search with price filters"""
        # Mock request data
        mock_request.httprequest.get_json.return_value = {
            'query': 'test',
            'limit': 20,
            'offset': 0,
            'category_id': self.test_category.id,
            'price_min': 10.00,
            'price_max': 20.00
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.order.read']
        }
        
        # Call endpoint
        response = self.controller.search_products(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        products = response_data['data']['products']
        for product in products:
            self.assertGreaterEqual(product['list_price'], 10.00)
            self.assertLessEqual(product['list_price'], 20.00)

    @patch('odoo.http.request')
    def test_get_categories_success(self, mock_request):
        """Test successful categories retrieval"""
        # Mock request parameters
        mock_request.httprequest.args.get.return_value = None
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.order.read']
        }
        
        # Call endpoint
        response = self.controller.get_categories(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertIn('categories', response_data['data'])
        
        # Should find our test category
        category_found = any(cat['name'] == 'Test Category' for cat in response_data['data']['categories'])
        self.assertTrue(category_found)

    @patch('odoo.http.request')
    def test_get_products_batch_success(self, mock_request):
        """Test successful batch products retrieval"""
        # Mock request data
        mock_request.httprequest.get_json.return_value = {
            'product_ids': [self.test_product1.id, self.test_product2.id],
            'include_inactive': False
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.order.read']
        }
        
        # Call endpoint
        response = self.controller.get_products_batch(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertTrue(response_data['success'])
        self.assertEqual(len(response_data['data']['products']), 2)
        
        # Check that both products are returned
        product_ids = [p['id'] for p in response_data['data']['products']]
        self.assertIn(self.test_product1.id, product_ids)
        self.assertIn(self.test_product2.id, product_ids)

    @patch('odoo.http.request')
    def test_get_products_batch_too_many(self, mock_request):
        """Test batch products with too many IDs"""
        # Mock request data with too many product IDs
        product_ids = list(range(1, 102))  # 101 products
        mock_request.httprequest.get_json.return_value = {
            'product_ids': product_ids,
            'include_inactive': False
        }
        mock_request.httprequest.is_json = True
        mock_request.env = self.env
        
        # Mock auth info
        auth_info = {
            'user_id': self.test_user.id,
            'permissions': ['pos.order.read']
        }
        
        # Call endpoint
        response = self.controller.get_products_batch(auth_info=auth_info)
        
        # Parse response
        response_data = json.loads(response.data.decode())
        
        # Assertions
        self.assertFalse(response_data['success'])
        self.assertEqual(response.status_code, 400)

    def test_serialize_product_basic(self):
        """Test basic product serialization"""
        serialized = self.controller._serialize_product(self.test_product1)
        
        # Check required fields
        self.assertEqual(serialized['id'], self.test_product1.id)
        self.assertEqual(serialized['name'], 'Test Pizza')
        self.assertEqual(serialized['barcode'], '1234567890123')
        self.assertEqual(serialized['list_price'], 15.99)
        self.assertEqual(serialized['category_id'], self.test_category.id)

    def test_serialize_product_detailed(self):
        """Test detailed product serialization"""
        serialized = self.controller._serialize_product(self.test_product1, detailed=True)
        
        # Check that detailed fields are included
        self.assertIn('description', serialized)
        self.assertIn('weight', serialized)
        self.assertIn('taxes', serialized)
        self.assertIn('attributes', serialized)
        self.assertIn('variants', serialized)

    def test_serialize_category(self):
        """Test category serialization"""
        serialized = self.controller._serialize_category(self.test_category)
        
        # Check required fields
        self.assertEqual(serialized['id'], self.test_category.id)
        self.assertEqual(serialized['name'], 'Test Category')
        self.assertEqual(serialized['sequence'], 1)
        self.assertIn('product_count', serialized)

    def tearDown(self):
        """Clean up test data"""
        super().tearDown()
        self.test_product1.unlink()
        self.test_product2.unlink()
        self.test_category.unlink()
        self.test_user.unlink() 