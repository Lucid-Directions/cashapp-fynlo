#!/usr/bin/env python3
"""
Explore Supabase Database Tables and Data
This script connects to Supabase and shows all available tables and their data
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich import print as rprint

# Load environment variables
load_dotenv()

console = Console()

def get_supabase_client():
    """Create Supabase client with service role key for full access"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_service_key:
        console.print("❌ Missing Supabase credentials in environment variables", style="red")
        return None
    
    return create_client(supabase_url, supabase_service_key)

def explore_table_data(supabase: Client, table_name: str, limit: int = 5):
    """Fetch and display sample data from a table"""
    try:
        # Query the table
        result = supabase.table(table_name).select("*").limit(limit).execute()
        
        if not result.data:
            return f"Empty table (0 records)"
        
        # Get total count
        count_result = supabase.table(table_name).select("*", count="exact").execute()
        total_count = count_result.count if hasattr(count_result, 'count') else len(result.data)
        
        return {
            "sample_data": result.data[:3],  # Show first 3 records
            "total_count": total_count,
            "columns": list(result.data[0].keys()) if result.data else []
        }
    except Exception as e:
        return f"Error accessing table: {str(e)}"

def main():
    console.print("\n[bold cyan]🔍 Supabase Database Explorer[/bold cyan]")
    console.print("=" * 60)
    
    # Get Supabase client
    supabase = get_supabase_client()
    if not supabase:
        return
    
    # Define all tables from the types file
    tables = {
        "🍽️ Restaurant Core": [
            "restaurants",
            "restaurant_settings", 
            "restaurant_bank_details",
            "restaurant_analytics",
            "user_restaurants"
        ],
        "📋 Menu Management": [
            "menu_categories",
            "menu_items",
            "menu_modifiers",
            "modifier_options",
            "menu_item_modifiers"
        ],
        "🛒 Orders & Payments": [
            "orders",
            "order_items",
            "payments",
            "restaurant_tables"
        ],
        "👥 Staff & Users": [
            "staff_members",
            "staff_schedules",
            "staff_invitations",
            "user_roles",
            "user_subscriptions",
            "profiles"
        ],
        "🎯 Loyalty & Marketing": [
            "loyalty_programs",
            "loyalty_customer_data",
            "loyalty_transactions",
            "loyalty_analytics",
            "loyalty_integrations",
            "loyalty_ab_tests",
            "loyalty_ab_assignments",
            "qr_campaigns",
            "qr_campaign_usage"
        ],
        "🏪 Customer & Inventory": [
            "restaurant_customers",
            "inventory_items"
        ],
        "⚙️ Platform": [
            "platform_settings"
        ]
    }
    
    # Create a tree view of all tables
    tree = Tree("📊 [bold]Supabase Database Structure[/bold]")
    
    for category, table_list in tables.items():
        category_branch = tree.add(f"[yellow]{category}[/yellow]")
        
        for table_name in table_list:
            # Get table info
            table_info = explore_table_data(supabase, table_name, limit=5)
            
            if isinstance(table_info, dict):
                count = table_info.get('total_count', 0)
                columns = len(table_info.get('columns', []))
                table_branch = category_branch.add(
                    f"[green]{table_name}[/green] "
                    f"([cyan]{count} records[/cyan], "
                    f"[magenta]{columns} columns[/magenta])"
                )
                
                # Show column names
                if table_info.get('columns'):
                    cols_text = ", ".join(table_info['columns'][:5])
                    if len(table_info['columns']) > 5:
                        cols_text += f" ... (+{len(table_info['columns']) - 5} more)"
                    table_branch.add(f"[dim]Columns: {cols_text}[/dim]")
            else:
                category_branch.add(f"[red]{table_name}[/red] - {table_info}")
    
    console.print("\n")
    console.print(tree)
    
    # Show user's subscription details
    console.print("\n[bold cyan]👤 Your User Details[/bold cyan]")
    
    try:
        # Get users from auth schema
        users_result = supabase.auth.admin.list_users()
        users_list = users_result.users if hasattr(users_result, 'users') else users_result
        
        # Find our user
        user_email = sys.argv[1] if len(sys.argv) > 1 else os.getenv("TEST_USER_EMAIL", "arnaud_decube@hotmail.com")
        user_found = None
        
        for user in users_list:
            if user.email == user_email:
                user_found = user
                break
        
        if user_found:
            # Create user info table
            user_table = Table(title=f"User: {user_found.email}")
            user_table.add_column("Property", style="cyan")
            user_table.add_column("Value", style="green")
            
            user_table.add_row("User ID", user_found.id)
            user_table.add_row("Email", user_found.email)
            user_table.add_row("Created", str(user_found.created_at)[:19])
            
            # Show metadata
            if user_found.user_metadata:
                for key, value in user_found.user_metadata.items():
                    if key == "enabled_features" and isinstance(value, list):
                        user_table.add_row(key, f"{len(value)} features")
                    else:
                        user_table.add_row(key, str(value))
            
            console.print(user_table)
            
            # Check user_subscriptions table
            sub_result = supabase.table("user_subscriptions").select("*").eq("user_id", user_found.id).execute()
            if sub_result.data:
                console.print("\n[yellow]Subscription Details:[/yellow]")
                sub = sub_result.data[0]
                console.print(f"  Plan: [green]{sub.get('subscription_plan', 'N/A')}[/green]")
                console.print(f"  Platform Owner: [green]{sub.get('is_platform_owner', False)}[/green]")
                if sub.get('enabled_features'):
                    console.print(f"  Features: [cyan]{len(sub['enabled_features'])} enabled[/cyan]")
            
            # Check restaurant association
            rest_result = supabase.table("user_restaurants").select("*, restaurants(*)").eq("user_id", user_found.id).execute()
            if rest_result.data:
                console.print("\n[yellow]Restaurant Associations:[/yellow]")
                for assoc in rest_result.data:
                    rest = assoc.get('restaurants', {})
                    console.print(f"  - [green]{rest.get('name', 'Unknown')}[/green] (Role: {assoc.get('role', 'N/A')})")
    
    except Exception as e:
        console.print(f"[red]Error fetching user details: {str(e)}[/red]")
    
    # Show sample data from key tables
    console.print("\n[bold cyan]📝 Sample Data from Key Tables[/bold cyan]")
    
    key_tables = ["restaurants", "menu_items", "orders", "loyalty_programs"]
    
    for table_name in key_tables:
        try:
            result = supabase.table(table_name).select("*").limit(2).execute()
            if result.data:
                console.print(f"\n[yellow]{table_name.upper()}:[/yellow]")
                for i, record in enumerate(result.data, 1):
                    console.print(f"  Record {i}:")
                    for key, value in list(record.items())[:5]:  # Show first 5 fields
                        if isinstance(value, (dict, list)):
                            console.print(f"    {key}: [dim]{type(value).__name__}[/dim]")
                        else:
                            console.print(f"    {key}: [green]{value}[/green]")
                    if len(record) > 5:
                        console.print(f"    [dim]... +{len(record) - 5} more fields[/dim]")
        except Exception as e:
            console.print(f"\n[red]Error reading {table_name}: {str(e)}[/red]")
    
    # Show Supabase functions
    console.print("\n[bold cyan]⚡ Available Database Functions[/bold cyan]")
    functions = [
        "get_user_restaurant_id(user_id) - Get user's restaurant",
        "get_user_role(user_id) - Get user's role",
        "has_role(user_id, role) - Check if user has role",
        "user_has_feature(user_id, feature) - Check feature access",
        "user_has_restaurant_access(user_id, restaurant_id) - Check access",
        "user_has_subscription_level(user_id, level) - Check subscription",
        "user_owns_restaurant(user_id, restaurant_id) - Check ownership"
    ]
    
    for func in functions:
        console.print(f"  • [cyan]{func}[/cyan]")
    
    # Summary
    console.print("\n[bold green]✅ Summary[/bold green]")
    console.print("Your Supabase database contains:")
    total_tables = sum(len(table_list) for table_list in tables.values())
    console.print(f"  • [cyan]{total_tables} tables[/cyan] across {len(tables)} categories")
    console.print(f"  • Full loyalty program infrastructure")
    console.print(f"  • A/B testing capabilities")
    console.print(f"  • QR code campaign management")
    console.print(f"  • Advanced analytics tracking")
    console.print(f"  • Multi-restaurant support")
    console.print(f"  • Staff scheduling and management")
    console.print(f"  • Inventory tracking")
    console.print(f"  • Customer database with preferences")
    
    console.print("\n[dim]This appears to be a comprehensive restaurant POS system with")
    console.print("advanced features that go well beyond basic authentication![/dim]")

if __name__ == "__main__":
    main()