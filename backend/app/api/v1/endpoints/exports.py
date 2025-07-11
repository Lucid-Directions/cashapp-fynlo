"""
Export API endpoints for Fynlo POS - Portal export functionality
"""

from typing import Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
import io
import csv
import json
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from app.core.database import get_db, Product, Category, Order, OrderItem, Restaurant, User, Customer, Inventory, Employee
from app.core.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.core.permissions import check_permission
from app.services.activity_logger import ActivityLogger
from app.middleware.rate_limit_middleware import limiter, PORTAL_EXPORT_RATE

router = APIRouter()

@router.get("/menu/{restaurant_id}/export")
@limiter.limit(PORTAL_EXPORT_RATE)
async def export_menu(
    restaurant_id: str,
    format: str = Query("json", regex="^(json|csv|pdf)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export menu in various formats for portal"""
    
    # Check permissions
    if str(current_user.restaurant_id) != restaurant_id and current_user.role != 'platform_owner':
        raise HTTPException(status_code=403, detail="Not authorized to export this menu")
    
    # Get restaurant details
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Get all products with categories
    products = db.query(Product, Category).join(
        Category, Product.category_id == Category.id
    ).filter(
        Product.restaurant_id == restaurant_id,
        Product.is_active == True
    ).order_by(Category.sort_order, Category.name, Product.name).all()
    
    # Log the export activity
    await ActivityLogger.log_export(
        db=db,
        user_id=str(current_user.id),
        restaurant_id=restaurant_id,
        export_type="menu",
        format=format,
        record_count=len(products)
    )
    
    if format == "json":
        # JSON export
        menu_data = {
            "restaurant": {
                "id": str(restaurant.id),
                "name": restaurant.name,
                "export_date": datetime.utcnow().isoformat()
            },
            "categories": {},
            "items": []
        }
        
        for product, category in products:
            if category.name not in menu_data["categories"]:
                menu_data["categories"][category.name] = {
                    "id": str(category.id),
                    "name": category.name,
                    "items": []
                }
            
            item_data = {
                "id": str(product.id),
                "name": product.name,
                "description": product.description,
                "price": float(product.price),
                "category": category.name,
                "is_active": product.is_active,
                "created_at": product.created_at.isoformat() if product.created_at else None
            }
            
            menu_data["items"].append(item_data)
            menu_data["categories"][category.name]["items"].append(item_data)
        
        return StreamingResponse(
            io.BytesIO(json.dumps(menu_data, indent=2).encode()),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=menu_{restaurant_id}_{datetime.now().strftime('%Y%m%d')}.json"}
        )
    
    elif format == "csv":
        # CSV export
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write headers
        writer.writerow(["Category", "Item Name", "Description", "Price", "Status", "Created Date"])
        
        # Write data
        for product, category in products:
            writer.writerow([
                category.name,
                product.name,
                product.description or "",
                f"£{product.price:.2f}",
                "Active" if product.is_active else "Inactive",
                product.created_at.strftime("%Y-%m-%d") if product.created_at else ""
            ])
        
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=menu_{restaurant_id}_{datetime.now().strftime('%Y%m%d')}.csv"}
        )
    
    else:  # PDF
        # PDF export
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
        
        # Container for the 'Flowable' objects
        elements = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#2C3E50'),
            spaceAfter=30,
            alignment=1  # Center
        )
        elements.append(Paragraph(f"{restaurant.name} Menu", title_style))
        elements.append(Spacer(1, 0.3*inch))
        
        # Group products by category
        current_category = None
        for product, category in products:
            if category.name != current_category:
                # Category header
                category_style = ParagraphStyle(
                    'CategoryStyle',
                    parent=styles['Heading2'],
                    fontSize=18,
                    textColor=colors.HexColor('#34495E'),
                    spaceBefore=20,
                    spaceAfter=10
                )
                elements.append(Paragraph(category.name, category_style))
                current_category = category.name
            
            # Product details
            product_data = [
                [product.name, f"£{product.price:.2f}"]
            ]
            if product.description:
                product_data.append([product.description, ""])
            
            t = Table(product_data, colWidths=[4.5*inch, 1.5*inch])
            t.setStyle(TableStyle([
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (1, 0), 12),
                ('FONTNAME', (0, 1), (1, 1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (1, 1), 10),
                ('TEXTCOLOR', (0, 1), (1, 1), colors.gray),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ]))
            elements.append(t)
        
        # Footer
        footer_style = ParagraphStyle(
            'FooterStyle',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.gray,
            alignment=1,
            spaceBefore=30
        )
        elements.append(Spacer(1, 0.5*inch))
        elements.append(Paragraph(f"Generated on {datetime.now().strftime('%B %d, %Y')}", footer_style))
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=menu_{restaurant_id}_{datetime.now().strftime('%Y%m%d')}.pdf"}
        )


@router.get("/reports/{restaurant_id}/export")
@limiter.limit(PORTAL_EXPORT_RATE)
async def export_report(
    restaurant_id: str,
    report_type: str = Query(..., regex="^(sales|inventory|staff|customers|financial)$"),
    format: str = Query("json", regex="^(json|csv|pdf)$"),
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export various reports in different formats"""
    
    # Check permissions
    if str(current_user.restaurant_id) != restaurant_id and current_user.role != 'platform_owner':
        raise HTTPException(status_code=403, detail="Not authorized to export reports for this restaurant")
    
    # Get restaurant
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Log the export activity
    await ActivityLogger.log_export(
        db=db,
        user_id=str(current_user.id),
        restaurant_id=restaurant_id,
        export_type=report_type,
        format=format,
        record_count=0  # Will be updated based on report type
    )
    
    # Generate report data based on type
    if report_type == "sales":
        # Get orders data
        orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= date_from,
            Order.created_at <= date_to,
            Order.status.in_(['completed', 'paid'])
        ).all()
        
        report_data = {
            "restaurant": restaurant.name,
            "report_type": "Sales Report",
            "period": f"{date_from} to {date_to}",
            "summary": {
                "total_orders": len(orders),
                "total_revenue": float(sum(order.total_amount for order in orders)),
                "average_order_value": float(sum(order.total_amount for order in orders) / len(orders)) if orders else 0
            },
            "daily_sales": []
        }
        
        # Group by date
        daily_sales = {}
        for order in orders:
            date_key = order.created_at.date()
            if date_key not in daily_sales:
                daily_sales[date_key] = {"count": 0, "revenue": 0}
            daily_sales[date_key]["count"] += 1
            daily_sales[date_key]["revenue"] += float(order.total_amount)
        
        report_data["daily_sales"] = [
            {
                "date": str(date_key),
                "orders": data["count"],
                "revenue": data["revenue"]
            }
            for date_key, data in sorted(daily_sales.items())
        ]
        
    elif report_type == "inventory":
        # Get inventory data
        inventory_items = db.query(Inventory).filter(
            Inventory.restaurant_id == restaurant_id
        ).all()
        
        report_data = {
            "restaurant": restaurant.name,
            "report_type": "Inventory Report",
            "generated_at": datetime.utcnow().isoformat(),
            "items": [
                {
                    "name": item.name,
                    "current_quantity": float(item.current_quantity),
                    "unit": item.unit,
                    "reorder_level": float(item.reorder_level) if item.reorder_level else None,
                    "status": "Low Stock" if item.current_quantity <= (item.reorder_level or 0) else "In Stock"
                }
                for item in inventory_items
            ]
        }
        
    elif report_type == "staff":
        # Get staff performance data
        employees = db.query(Employee).filter(
            Employee.restaurant_id == restaurant_id,
            Employee.is_active == True
        ).all()
        
        report_data = {
            "restaurant": restaurant.name,
            "report_type": "Staff Report",
            "period": f"{date_from} to {date_to}",
            "employees": [
                {
                    "name": f"{emp.first_name} {emp.last_name}",
                    "role": emp.role,
                    "email": emp.email,
                    "status": "Active" if emp.is_active else "Inactive"
                }
                for emp in employees
            ]
        }
        
    elif report_type == "customers":
        # Get customer data
        customers = db.query(Customer).filter(
            Customer.restaurant_id == restaurant_id
        ).all()
        
        report_data = {
            "restaurant": restaurant.name,
            "report_type": "Customer Report",
            "generated_at": datetime.utcnow().isoformat(),
            "total_customers": len(customers),
            "customers": [
                {
                    "name": f"{cust.first_name} {cust.last_name}",
                    "email": cust.email,
                    "phone": cust.phone,
                    "total_orders": cust.total_orders if hasattr(cust, 'total_orders') else 0,
                    "total_spent": float(cust.total_spent) if hasattr(cust, 'total_spent') else 0
                }
                for cust in customers[:100]  # Limit to 100 for export
            ]
        }
        
    else:  # financial
        # Get financial summary
        orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= date_from,
            Order.created_at <= date_to,
            Order.status.in_(['completed', 'paid'])
        ).all()
        
        total_revenue = sum(order.total_amount for order in orders)
        total_tax = sum(order.tax_amount for order in orders)
        total_tips = sum(order.tip_amount for order in orders if order.tip_amount)
        
        report_data = {
            "restaurant": restaurant.name,
            "report_type": "Financial Report",
            "period": f"{date_from} to {date_to}",
            "summary": {
                "gross_revenue": float(total_revenue),
                "tax_collected": float(total_tax),
                "tips_collected": float(total_tips),
                "net_revenue": float(total_revenue - total_tax),
                "transaction_count": len(orders)
            }
        }
    
    # Export based on format
    if format == "json":
        return StreamingResponse(
            io.BytesIO(json.dumps(report_data, indent=2).encode()),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={report_type}_report_{restaurant_id}_{datetime.now().strftime('%Y%m%d')}.json"}
        )
    
    elif format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write report specific CSV
        if report_type == "sales":
            writer.writerow(["Date", "Orders", "Revenue"])
            for day in report_data["daily_sales"]:
                writer.writerow([day["date"], day["orders"], f"£{day['revenue']:.2f}"])
        
        elif report_type == "inventory":
            writer.writerow(["Item", "Quantity", "Unit", "Reorder Level", "Status"])
            for item in report_data["items"]:
                writer.writerow([
                    item["name"],
                    item["current_quantity"],
                    item["unit"],
                    item["reorder_level"] or "N/A",
                    item["status"]
                ])
        
        elif report_type == "staff":
            writer.writerow(["Name", "Role", "Email", "Status"])
            for emp in report_data["employees"]:
                writer.writerow([emp["name"], emp["role"], emp["email"], emp["status"]])
        
        elif report_type == "customers":
            writer.writerow(["Name", "Email", "Phone", "Total Orders", "Total Spent"])
            for cust in report_data["customers"]:
                writer.writerow([
                    cust["name"],
                    cust["email"],
                    cust["phone"],
                    cust["total_orders"],
                    f"£{cust['total_spent']:.2f}"
                ])
        
        else:  # financial
            writer.writerow(["Metric", "Amount"])
            for key, value in report_data["summary"].items():
                if key != "transaction_count":
                    writer.writerow([key.replace("_", " ").title(), f"£{value:.2f}"])
                else:
                    writer.writerow([key.replace("_", " ").title(), value])
        
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={report_type}_report_{restaurant_id}_{datetime.now().strftime('%Y%m%d')}.csv"}
        )
    
    else:  # PDF - simplified version
        return APIResponseHelper.error(
            message="PDF export coming soon. Please use JSON or CSV format for now.",
            status_code=501
        )


@router.post("/menu/{restaurant_id}/import")
@limiter.limit(PORTAL_EXPORT_RATE)
async def import_menu(
    restaurant_id: str,
    file_content: dict,  # JSON content from request body
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Import menu from JSON format"""
    
    # Check permissions
    if str(current_user.restaurant_id) != restaurant_id and current_user.role != 'platform_owner':
        raise HTTPException(status_code=403, detail="Not authorized to import menu for this restaurant")
    
    try:
        imported_count = 0
        errors = []
        
        # Process categories first
        category_map = {}
        for cat_name, cat_data in file_content.get("categories", {}).items():
            # Check if category exists
            existing_cat = db.query(Category).filter(
                Category.restaurant_id == restaurant_id,
                Category.name == cat_name
            ).first()
            
            if not existing_cat:
                # Create new category
                new_cat = Category(
                    restaurant_id=restaurant_id,
                    name=cat_name,
                    is_active=True,
                    sort_order=len(category_map)
                )
                db.add(new_cat)
                db.flush()
                category_map[cat_name] = new_cat.id
            else:
                category_map[cat_name] = existing_cat.id
        
        # Process items
        for item in file_content.get("items", []):
            try:
                # Get category ID
                category_id = category_map.get(item.get("category"))
                if not category_id:
                    errors.append(f"Category not found for item: {item.get('name')}")
                    continue
                
                # Check if product exists
                existing_product = db.query(Product).filter(
                    Product.restaurant_id == restaurant_id,
                    Product.name == item.get("name")
                ).first()
                
                if existing_product:
                    # Update existing
                    existing_product.description = item.get("description")
                    existing_product.price = item.get("price")
                    existing_product.category_id = category_id
                    existing_product.is_active = item.get("is_active", True)
                else:
                    # Create new
                    new_product = Product(
                        restaurant_id=restaurant_id,
                        name=item.get("name"),
                        description=item.get("description"),
                        price=item.get("price"),
                        category_id=category_id,
                        is_active=item.get("is_active", True)
                    )
                    db.add(new_product)
                
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Error importing {item.get('name')}: {str(e)}")
        
        db.commit()
        
        return APIResponseHelper.success(
            data={
                "imported_count": imported_count,
                "errors": errors
            },
            message=f"Successfully imported {imported_count} items"
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")