import json
import logging
from datetime import datetime
import base64

from odoo import http
from odoo.http import request
from odoo.exceptions import ValidationError, AccessDenied
from odoo.addons.point_of_sale_api.controllers.base import POSAPIController, api_route

_logger = logging.getLogger(__name__)


class ProductsController(POSAPIController):
    """Product and menu endpoints for POS API"""

    @api_route('/api/v1/products', methods=['GET'], auth=True, permissions=['pos.order.read'])
    def get_products(self, auth_info=None):
        """
        Get all products available in POS
        
        GET /api/v1/products?limit=50&offset=0&category_id=123&search=pizza
        """
        try:
            # Get query parameters
            limit = int(request.httprequest.args.get('limit', 50))
            offset = int(request.httprequest.args.get('offset', 0))
            category_id = request.httprequest.args.get('category_id')
            search = request.httprequest.args.get('search')
            
            # Validate limits
            if limit > 100:
                limit = 100
            
            # Build domain
            domain = [
                ('available_in_pos', '=', True),
                ('active', '=', True),
                ('sale_ok', '=', True)
            ]
            
            if category_id:
                domain.append(('pos_categ_id', '=', int(category_id)))
            
            if search:
                domain.append(('name', 'ilike', search))
            
            # Get products
            products = request.env['product.product'].search(
                domain,
                limit=limit,
                offset=offset,
                order='name asc'
            )
            
            # Get total count for pagination
            total_count = request.env['product.product'].search_count(domain)
            
            # Serialize products
            product_data = []
            for product in products:
                product_data.append(self._serialize_product(product))
            
            response_data = {
                'products': product_data,
                'pagination': {
                    'total': total_count,
                    'limit': limit,
                    'offset': offset,
                    'has_more': (offset + limit) < total_count
                }
            }
            
            return self._json_response(response_data)
            
        except Exception as e:
            _logger.error(f"Error fetching products: {e}")
            return self._error_response("Failed to fetch products", status=500)

    @api_route('/api/v1/products/<int:product_id>', methods=['GET'], auth=True, permissions=['pos.order.read'])
    def get_product(self, product_id, auth_info=None):
        """
        Get specific product by ID
        
        GET /api/v1/products/123
        """
        try:
            product = request.env['product.product'].search([
                ('id', '=', product_id),
                ('available_in_pos', '=', True),
                ('active', '=', True)
            ], limit=1)
            
            if not product:
                return self._error_response("Product not found", status=404)
            
            product_data = self._serialize_product(product, detailed=True)
            
            return self._json_response(product_data)
            
        except Exception as e:
            _logger.error(f"Error fetching product {product_id}: {e}")
            return self._error_response("Failed to fetch product", status=500)

    @api_route('/api/v1/products/category/<int:category_id>', methods=['GET'], auth=True, permissions=['pos.order.read'])
    def get_products_by_category(self, category_id, auth_info=None):
        """
        Get products by category
        
        GET /api/v1/products/category/123?limit=50&offset=0
        """
        try:
            # Get query parameters
            limit = int(request.httprequest.args.get('limit', 50))
            offset = int(request.httprequest.args.get('offset', 0))
            
            # Validate category exists
            category = request.env['pos.category'].search([
                ('id', '=', category_id)
            ], limit=1)
            
            if not category:
                return self._error_response("Category not found", status=404)
            
            # Get products in category
            domain = [
                ('pos_categ_id', '=', category_id),
                ('available_in_pos', '=', True),
                ('active', '=', True),
                ('sale_ok', '=', True)
            ]
            
            products = request.env['product.product'].search(
                domain,
                limit=limit,
                offset=offset,
                order='name asc'
            )
            
            total_count = request.env['product.product'].search_count(domain)
            
            # Serialize products
            product_data = []
            for product in products:
                product_data.append(self._serialize_product(product))
            
            response_data = {
                'category': {
                    'id': category.id,
                    'name': category.name,
                    'parent_id': category.parent_id.id if category.parent_id else None
                },
                'products': product_data,
                'pagination': {
                    'total': total_count,
                    'limit': limit,
                    'offset': offset,
                    'has_more': (offset + limit) < total_count
                }
            }
            
            return self._json_response(response_data)
            
        except Exception as e:
            _logger.error(f"Error fetching products by category {category_id}: {e}")
            return self._error_response("Failed to fetch products by category", status=500)

    @api_route('/api/v1/products/barcode/<string:barcode>', methods=['GET'], auth=True, permissions=['pos.order.read'])
    def get_product_by_barcode(self, barcode, auth_info=None):
        """
        Get product by barcode
        
        GET /api/v1/products/barcode/1234567890123
        """
        try:
            product = request.env['product.product'].search([
                ('barcode', '=', barcode),
                ('available_in_pos', '=', True),
                ('active', '=', True)
            ], limit=1)
            
            if not product:
                return self._error_response("Product not found", status=404)
            
            product_data = self._serialize_product(product, detailed=True)
            
            return self._json_response(product_data)
            
        except Exception as e:
            _logger.error(f"Error fetching product by barcode {barcode}: {e}")
            return self._error_response("Failed to fetch product by barcode", status=500)

    @api_route('/api/v1/products/search', methods=['POST'], auth=True, permissions=['pos.order.read'])
    def search_products(self, auth_info=None):
        """
        Search products with fuzzy matching
        
        POST /api/v1/products/search
        {
            "query": "pizza",
            "limit": 20,
            "offset": 0,
            "category_id": 123,
            "price_min": 10.00,
            "price_max": 50.00
        }
        """
        try:
            data = self._validate_json(['query'])
            
            query = data.get('query')
            limit = min(int(data.get('limit', 20)), 100)
            offset = int(data.get('offset', 0))
            category_id = data.get('category_id')
            price_min = data.get('price_min')
            price_max = data.get('price_max')
            
            # Build search domain
            domain = [
                ('available_in_pos', '=', True),
                ('active', '=', True),
                ('sale_ok', '=', True)
            ]
            
            # Add search conditions
            if query:
                domain.append('|')
                domain.append(('name', 'ilike', query))
                domain.append(('default_code', 'ilike', query))
            
            if category_id:
                domain.append(('pos_categ_id', '=', category_id))
            
            if price_min is not None:
                domain.append(('list_price', '>=', price_min))
            
            if price_max is not None:
                domain.append(('list_price', '<=', price_max))
            
            # Search products
            products = request.env['product.product'].search(
                domain,
                limit=limit,
                offset=offset,
                order='name asc'
            )
            
            total_count = request.env['product.product'].search_count(domain)
            
            # Serialize products
            product_data = []
            for product in products:
                product_data.append(self._serialize_product(product))
            
            response_data = {
                'query': query,
                'products': product_data,
                'pagination': {
                    'total': total_count,
                    'limit': limit,
                    'offset': offset,
                    'has_more': (offset + limit) < total_count
                }
            }
            
            return self._json_response(response_data)
            
        except Exception as e:
            _logger.error(f"Error searching products: {e}")
            return self._error_response("Failed to search products", status=500)

    @api_route('/api/v1/categories', methods=['GET'], auth=True, permissions=['pos.order.read'])
    def get_categories(self, auth_info=None):
        """
        Get all POS categories
        
        GET /api/v1/categories?parent_id=123
        """
        try:
            parent_id = request.httprequest.args.get('parent_id')
            
            # Build domain
            domain = []
            if parent_id:
                domain.append(('parent_id', '=', int(parent_id)))
            else:
                domain.append(('parent_id', '=', False))
            
            # Get categories
            categories = request.env['pos.category'].search(
                domain,
                order='sequence, name'
            )
            
            # Serialize categories
            category_data = []
            for category in categories:
                category_data.append(self._serialize_category(category))
            
            return self._json_response({'categories': category_data})
            
        except Exception as e:
            _logger.error(f"Error fetching categories: {e}")
            return self._error_response("Failed to fetch categories", status=500)

    @api_route('/api/v1/products/favorites', methods=['GET'], auth=True, permissions=['pos.order.read'])
    def get_favorite_products(self, auth_info=None):
        """
        Get favorite/most ordered products
        
        GET /api/v1/products/favorites?limit=20
        """
        try:
            limit = int(request.httprequest.args.get('limit', 20))
            
            # Get most ordered products from POS order lines
            # This is a simplified approach - in production you might want to use analytics
            query = """
                SELECT p.id, COUNT(pol.id) as order_count
                FROM product_product p
                JOIN pos_order_line pol ON p.id = pol.product_id
                JOIN pos_order po ON pol.order_id = po.id
                WHERE p.available_in_pos = true 
                AND p.active = true
                AND po.state = 'paid'
                AND po.date_order >= (CURRENT_DATE - INTERVAL '30 days')
                GROUP BY p.id
                ORDER BY order_count DESC
                LIMIT %s
            """
            
            request.env.cr.execute(query, (limit,))
            results = request.env.cr.fetchall()
            
            if not results:
                # Fallback to random popular products
                products = request.env['product.product'].search([
                    ('available_in_pos', '=', True),
                    ('active', '=', True),
                    ('sale_ok', '=', True)
                ], limit=limit, order='name')
            else:
                product_ids = [result[0] for result in results]
                products = request.env['product.product'].browse(product_ids)
            
            # Serialize products
            product_data = []
            for product in products:
                product_data.append(self._serialize_product(product))
            
            return self._json_response({'products': product_data})
            
        except Exception as e:
            _logger.error(f"Error fetching favorite products: {e}")
            return self._error_response("Failed to fetch favorite products", status=500)

    @api_route('/api/v1/products/batch', methods=['POST'], auth=True, permissions=['pos.order.read'])
    def get_products_batch(self, auth_info=None):
        """
        Get multiple products by IDs (for offline sync)
        
        POST /api/v1/products/batch
        {
            "product_ids": [1, 2, 3, 4, 5],
            "include_inactive": false
        }
        """
        try:
            data = self._validate_json(['product_ids'])
            
            product_ids = data.get('product_ids')
            include_inactive = data.get('include_inactive', False)
            
            if not isinstance(product_ids, list):
                raise ValidationError("product_ids must be a list")
            
            if len(product_ids) > 100:
                raise ValidationError("Maximum 100 products per batch request")
            
            # Build domain
            domain = [('id', 'in', product_ids)]
            
            if not include_inactive:
                domain.extend([
                    ('available_in_pos', '=', True),
                    ('active', '=', True)
                ])
            
            # Get products
            products = request.env['product.product'].search(domain)
            
            # Serialize products
            product_data = []
            for product in products:
                product_data.append(self._serialize_product(product, detailed=True))
            
            return self._json_response({'products': product_data})
            
        except Exception as e:
            _logger.error(f"Error fetching products batch: {e}")
            return self._error_response("Failed to fetch products batch", status=500)

    def _serialize_product(self, product, detailed=False):
        """Serialize product for API response"""
        data = {
            'id': product.id,
            'name': product.name,
            'default_code': product.default_code,
            'barcode': product.barcode,
            'list_price': float(product.list_price),
            'standard_price': float(product.standard_price),
            'category_id': product.pos_categ_id.id if product.pos_categ_id else None,
            'category_name': product.pos_categ_id.name if product.pos_categ_id else None,
            'uom_id': product.uom_id.id,
            'uom_name': product.uom_id.name,
            'active': product.active,
            'available_in_pos': product.available_in_pos,
            'to_weight': product.to_weight,
            'taxes_id': [tax.id for tax in product.taxes_id],
        }
        
        # Add image (optimized for mobile)
        if product.image_1920:
            # Convert to smaller image for mobile
            image_data = base64.b64encode(product.image_128).decode('utf-8')
            data['image'] = f"data:image/png;base64,{image_data}"
        
        if detailed:
            data.update({
                'description': product.description or '',
                'description_sale': product.description_sale or '',
                'weight': float(product.weight) if product.weight else 0.0,
                'volume': float(product.volume) if product.volume else 0.0,
                'tracking': product.tracking,
                'sale_ok': product.sale_ok,
                'purchase_ok': product.purchase_ok,
                'taxes': [self._serialize_tax(tax) for tax in product.taxes_id],
                'attributes': self._get_product_attributes(product),
                'variants': self._get_product_variants(product),
            })
        
        return data
    
    def _serialize_category(self, category):
        """Serialize category for API response"""
        return {
            'id': category.id,
            'name': category.name,
            'parent_id': category.parent_id.id if category.parent_id else None,
            'parent_name': category.parent_id.name if category.parent_id else None,
            'sequence': category.sequence,
            'child_count': len(category.child_id),
            'product_count': request.env['product.product'].search_count([
                ('pos_categ_id', '=', category.id),
                ('available_in_pos', '=', True),
                ('active', '=', True)
            ])
        }
    
    def _serialize_tax(self, tax):
        """Serialize tax for API response"""
        return {
            'id': tax.id,
            'name': tax.name,
            'amount': float(tax.amount),
            'amount_type': tax.amount_type,
            'price_include': tax.price_include,
        }
    
    def _get_product_attributes(self, product):
        """Get product attributes"""
        attributes = []
        for attribute_line in product.product_template_attribute_line_ids:
            attributes.append({
                'attribute_id': attribute_line.attribute_id.id,
                'attribute_name': attribute_line.attribute_id.name,
                'values': [{
                    'id': value.id,
                    'name': value.name,
                    'price_extra': float(value.price_extra)
                } for value in attribute_line.value_ids]
            })
        return attributes
    
    def _get_product_variants(self, product):
        """Get product variants"""
        if not product.product_template_attribute_line_ids:
            return []
        
        variants = []
        for variant in product.product_tmpl_id.product_variant_ids:
            if variant.active and variant.available_in_pos:
                variants.append({
                    'id': variant.id,
                    'name': variant.name,
                    'default_code': variant.default_code,
                    'barcode': variant.barcode,
                    'list_price': float(variant.list_price),
                    'attributes': [{
                        'attribute_id': attr.attribute_id.id,
                        'attribute_name': attr.attribute_id.name,
                        'value_id': attr.product_attribute_value_id.id,
                        'value_name': attr.product_attribute_value_id.name,
                    } for attr in variant.product_template_attribute_value_ids]
                })
        return variants 