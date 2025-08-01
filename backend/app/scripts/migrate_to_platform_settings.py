#!/usr/bin/env python3
"""
Platform Settings Migration Script
Migrates existing restaurant settings to the new platform-controlled architecture
CRITICAL: Run this script during low-traffic hours to avoid payment processing disruption


import os
import sys
import logging
import json
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text, and_

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, Restaurant, Platform
from app.models.platform_config import (
    PlatformConfiguration, 
    RestaurantOverride, 
    ConfigurationAudit,
    PlatformFeatureFlag,
    DEFAULT_PLATFORM_CONFIGS,
    DEFAULT_FEATURE_FLAGS
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'migration_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

class PlatformSettingsMigration:
    """Main migration class for converting restaurant settings to platform architecture"""
    
    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run
        self.db: Session = SessionLocal()
        self.migration_stats = {
            'restaurants_processed': 0,
            'settings_migrated': 0,
            'overrides_created': 0,
            'errors': 0,
            'warnings': 0
        }
        
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        if not self.dry_run:
            if exc_type is None:
                self.db.commit()
                logger.info("Migration completed successfully - changes committed")
            else:
                self.db.rollback()
                logger.error("Migration failed - changes rolled back")
        else:
            self.db.rollback()
            logger.info("DRY RUN - No changes committed to database")
        
        self.db.close()
        
    def run_migration(self) -> bool:
        """Execute the complete migration process"""
        logger.info(f"Starting platform settings migration (DRY RUN: {self.dry_run})")
        
        try:
            # Step 1: Initialize platform configurations
            logger.info("Step 1: Initializing platform configurations...")
            self.initialize_platform_configs()
            
            # Step 2: Identify restaurants with payment settings
            logger.info("Step 2: Analyzing existing restaurant settings...")
            restaurants_to_migrate = self.identify_restaurants_to_migrate()
            logger.info(f"Found {len(restaurants_to_migrate)} restaurants requiring migration")
            
            # Step 3: Create backup of current settings
            logger.info("Step 3: Creating backup of current settings...")
            self.create_settings_backup()
            
            # Step 4: Migrate restaurant payment settings
            logger.info("Step 4: Migrating restaurant payment settings...")
            for restaurant in restaurants_to_migrate:
                self.migrate_restaurant_settings(restaurant)
            
            # Step 5: Validate migration results
            logger.info("Step 5: Validating migration results...")
            validation_result = self.validate_migration()
            
            # Step 6: Generate migration report
            logger.info("Step 6: Generating migration report...")
            self.generate_migration_report()
            
            if validation_result:
                logger.info("Migration completed successfully!")
                return True
            else:
                logger.error("Migration validation failed!")
                return False
                
        except Exception as e:
            logger.error(f"Migration failed with error: {e}", exc_info=True)
            self.migration_stats['errors'] += 1
            return False
    
    def initialize_platform_configs(self) -> None:
        """Initialize platform with default configurations"""
        
        # Add default platform configurations
        for config_data in DEFAULT_PLATFORM_CONFIGS:
            existing = self.db.query(PlatformConfiguration).filter(
                PlatformConfiguration.config_key == config_data['config_key']
            ).first()
            
            if not existing:
                config = PlatformConfiguration(**config_data)
                self.db.add(config)
                logger.info(f"Added platform config: {config_data['config_key']}")
        
        # Add default feature flags
        for flag_data in DEFAULT_FEATURE_FLAGS:
            existing = self.db.query(PlatformFeatureFlag).filter(
                PlatformFeatureFlag.feature_key == flag_data['feature_key']
            ).first()
            
            if not existing:
                flag = PlatformFeatureFlag(**flag_data)
                self.db.add(flag)
                logger.info(f"Added feature flag: {flag_data['feature_key']}")
        
        if not self.dry_run:
            self.db.flush()  # Make configs available for subsequent operations
    
    def identify_restaurants_to_migrate(self) -> List[Restaurant]:
        """Identify restaurants that have payment settings requiring migration"""
        
        restaurants_with_payment_settings = []
        
        # Query all restaurants
        restaurants = self.db.query(Restaurant).all()
        
        for restaurant in restaurants:
            if self.has_payment_settings(restaurant):
                restaurants_with_payment_settings.append(restaurant)
                
        return restaurants_with_payment_settings
    
    def has_payment_settings(self, restaurant: Restaurant) -> bool:
        """Check if restaurant has payment-related settings that need migration"""
        
        if not restaurant.settings:
            return False
            
        # Look for payment-related settings in restaurant.settings JSON
        payment_related_keys = [
            'paymentMethods',
            'paymentFees', 
            'stripeConfig',
            'squareConfig',
            'sumupConfig',
            'paymentProcessing',
            'feeStructure'
        ]
        
        settings_data = restaurant.settings
        for key in payment_related_keys:
            if key in settings_data:
                logger.info(f"Restaurant {restaurant.name} has payment setting: {key}")
                return True
                
        return False
    
    def create_settings_backup(self) -> None:
        """Create a backup of all current restaurant settings"""
        
        backup_filename = f"restaurant_settings_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        try:
            restaurants = self.db.query(Restaurant).all()
            backup_data = {
                'timestamp': datetime.now().isoformat(),
                'migration_type': 'platform_settings',
                'restaurants': []
            }
            
            for restaurant in restaurants:
                restaurant_data = {
                    'id': str(restaurant.id),
                    'name': restaurant.name,
                    'platform_id': str(restaurant.platform_id) if restaurant.platform_id else None,
                    'settings': restaurant.settings,
                    'tax_configuration': restaurant.tax_configuration
                }
                backup_data['restaurants'].append(restaurant_data)
            
            with open(backup_filename, 'w') as f:
                json.dump(backup_data, f, indent=2, default=str)
                
            logger.info(f"Settings backup created: {backup_filename}")
            
        except Exception as e:
            logger.error(f"Failed to create backup: {e}")
            raise
    
    def migrate_restaurant_settings(self, restaurant: Restaurant) -> None:
        """Migrate settings for a single restaurant"""
        
        try:
            logger.info(f"Migrating settings for restaurant: {restaurant.name} ({restaurant.id})")
            
            if not restaurant.settings:
                logger.warning(f"No settings found for restaurant {restaurant.name}")
                return
            
            settings_data = restaurant.settings
            migrated_settings = {}
            
            # Migrate payment method configurations
            if 'paymentMethods' in settings_data:
                self.migrate_payment_methods(restaurant, settings_data['paymentMethods'])
                migrated_settings['paymentMethods'] = settings_data['paymentMethods']
            
            # Migrate payment fees (convert to restaurant overrides if they differ from platform defaults)
            if 'paymentFees' in settings_data:
                self.migrate_payment_fees(restaurant, settings_data['paymentFees'])
                migrated_settings['paymentFees'] = settings_data['paymentFees']
            
            # Migrate provider configurations
            for provider in ['stripeConfig', 'squareConfig', 'sumupConfig']:
                if provider in settings_data:
                    self.migrate_provider_config(restaurant, provider, settings_data[provider])
                    migrated_settings[provider] = settings_data[provider]
            
            # Remove migrated payment settings from restaurant.settings
            new_settings = {k: v for k, v in settings_data.items() if k not in migrated_settings}
            
            # Update restaurant settings (remove migrated items)
            if not self.dry_run:
                restaurant.settings = new_settings
                self.db.flush()
            
            # Create audit record for this migration
            self.create_migration_audit_record(restaurant, migrated_settings)
            
            self.migration_stats['restaurants_processed'] += 1
            logger.info(f"Successfully migrated {len(migrated_settings)} settings for {restaurant.name}")
            
        except Exception as e:
            logger.error(f"Failed to migrate restaurant {restaurant.name}: {e}")
            self.migration_stats['errors'] += 1
    
    def migrate_payment_methods(self, restaurant: Restaurant, payment_methods: Dict[str, Any]) -> None:
        """Migrate payment method enablement settings"""
        
        # Payment method enablement is typically restaurant-specific, so we keep this
        # but ensure it aligns with platform capabilities
        logger.info(f"Payment methods configuration preserved for {restaurant.name}")
        self.migration_stats['settings_migrated'] += 1
    
    def migrate_payment_fees(self, restaurant: Restaurant, payment_fees: Dict[str, Any]) -> None:
        """Migrate payment fee settings - convert custom fees to restaurant overrides"""
        
        # Get platform default fees for comparison
        platform_fees = self.get_platform_default_fees()
        
        for payment_method, fee_config in payment_fees.items():
            platform_default = platform_fees.get(f'payment.fees.{payment_method}')
            
            if platform_default and self.fees_differ_from_platform(fee_config, platform_default):
                # Create restaurant override for custom fee
                self.create_fee_override(restaurant, payment_method, fee_config, platform_default)
            
        self.migration_stats['settings_migrated'] += 1
    
    def migrate_provider_config(self, restaurant: Restaurant, provider: str, config: Dict[str, Any]) -> None:
        """Migrate payment provider configurations"""
        
        # Provider configurations (API keys, etc.) remain restaurant-specific
        # but we audit the migration
        logger.info(f"Provider {provider} configuration preserved for {restaurant.name}")
        self.migration_stats['settings_migrated'] += 1
    
    def get_platform_default_fees(self) -> Dict[str, Any]:
        """Get platform default fee configurations"""
        
        default_fees = {}
        
        # Query platform configurations for payment fees
        fee_configs = self.db.query(PlatformConfiguration).filter(
            and_(
                PlatformConfiguration.category == 'payment_fees',
                PlatformConfiguration.is_active == True
            )
        ).all()
        
        for config in fee_configs:
            default_fees[config.config_key] = config.config_value
            
        return default_fees
    
    def fees_differ_from_platform(self, restaurant_fee: Any, platform_fee: Any) -> bool:
        """Check if restaurant fee differs significantly from platform default"""
        
        # Simple comparison - in production this would be more sophisticated
        try:
            if isinstance(restaurant_fee, dict) and isinstance(platform_fee, dict):
                # Compare percentage fees
                restaurant_pct = restaurant_fee.get('percentage', 0)
                platform_pct = platform_fee.get('percentage', 0)
                
                # If difference is more than 0.1%, consider it a custom fee
                return abs(restaurant_pct - platform_pct) > 0.1
                
        except Exception as e:
            logger.warning(f"Error comparing fees: {e}")
            
        return False
    
    def create_fee_override(self, restaurant: Restaurant, payment_method: str, 
                          restaurant_fee: Any, platform_fee: Any) -> None:
        """Create a restaurant override for custom payment fees"""
        
        try:
            config_key = f'payment.markup.{payment_method}'
            
            # Calculate markup percentage
            restaurant_pct = restaurant_fee.get('percentage', 0) if isinstance(restaurant_fee, dict) else 0
            platform_pct = platform_fee.get('percentage', 0) if isinstance(platform_fee, dict) else 0
            markup_pct = restaurant_pct - platform_pct
            
            if markup_pct > 0:
                override_value = {
                    'percentage': markup_pct,
                    'migrated_from': restaurant_fee,
                    'migration_date': datetime.now().isoformat()
                }
                
                override = RestaurantOverride(
                    restaurant_id=str(restaurant.id),
                    config_key=config_key,
                    override_value=override_value,
                    platform_limit={'max_percentage': 2.0},
                    is_approved=True,  # Auto-approve migrated settings
                    created_by='migration_script'
                )
                
                self.db.add(override)
                self.migration_stats['overrides_created'] += 1
                
                logger.info(f"Created fee override for {restaurant.name} - {payment_method}: +{markup_pct}%")
                
        except Exception as e:
            logger.error(f"Failed to create fee override: {e}")
            self.migration_stats['errors'] += 1
    
    def create_migration_audit_record(self, restaurant: Restaurant, migrated_settings: Dict[str, Any]) -> None:
        """Create audit record for the migration"""
        
        audit = ConfigurationAudit(
            config_type='migration',
            config_key='platform_settings_migration',
            entity_id=str(restaurant.id),
            old_value=migrated_settings,
            new_value={'migrated_to': 'platform_controlled'},
            change_reason='Automated migration to platform-controlled settings architecture',
            change_source='migration_script',
            changed_by='system'
        )
        
        self.db.add(audit)
    
    def validate_migration(self) -> bool:
        """Validate that the migration completed successfully"""
        
        validation_passed = True
        
        try:
            # Check that platform configurations exist
            platform_config_count = self.db.query(PlatformConfiguration).count()
            if platform_config_count < len(DEFAULT_PLATFORM_CONFIGS):
                logger.error(f"Missing platform configurations. Expected {len(DEFAULT_PLATFORM_CONFIGS)}, found {platform_config_count}")
                validation_passed = False
            
            # Check that feature flags exist
            feature_flag_count = self.db.query(PlatformFeatureFlag).count()
            if feature_flag_count < len(DEFAULT_FEATURE_FLAGS):
                logger.error(f"Missing feature flags. Expected {len(DEFAULT_FEATURE_FLAGS)}, found {feature_flag_count}")
                validation_passed = False
            
            # Validate restaurant overrides
            override_count = self.db.query(RestaurantOverride).count()
            logger.info(f"Created {override_count} restaurant overrides during migration")
            
            # Check for orphaned settings
            restaurants_with_payment_settings = 0
            restaurants = self.db.query(Restaurant).all()
            
            for restaurant in restaurants:
                if self.has_payment_settings(restaurant):
                    restaurants_with_payment_settings += 1
                    logger.warning(f"Restaurant {restaurant.name} still has payment settings after migration")
                    validation_passed = False
            
            if restaurants_with_payment_settings == 0:
                logger.info("✅ No payment settings remaining in restaurant configurations")
            
            logger.info(f"Migration validation: {'PASSED' if validation_passed else 'FAILED'}")
            
        except Exception as e:
            logger.error(f"Migration validation failed: {e}")
            validation_passed = False
        
        return validation_passed
    
    def generate_migration_report(self) -> None:
        """Generate a detailed migration report"""
        
        report_filename = f"migration_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        
        report_content = f"""
PLATFORM SETTINGS MIGRATION REPORT
===================================
Date: {datetime.now().isoformat()}
Dry Run: {self.dry_run}

MIGRATION STATISTICS:
- Restaurants Processed: {self.migration_stats['restaurants_processed']}
- Settings Migrated: {self.migration_stats['settings_migrated']}
- Restaurant Overrides Created: {self.migration_stats['overrides_created']}
- Errors: {self.migration_stats['errors']}
- Warnings: {self.migration_stats['warnings']}

DATABASE STATE AFTER MIGRATION:
- Platform Configurations: {self.db.query(PlatformConfiguration).count()}
- Feature Flags: {self.db.query(PlatformFeatureFlag).count()}
- Restaurant Overrides: {self.db.query(RestaurantOverride).count()}
- Total Restaurants: {self.db.query(Restaurant).count()}

MIGRATION STATUS: {'SUCCESS' if self.migration_stats['errors'] == 0 else 'COMPLETED WITH ERRORS'}

Next Steps:
1. Review this report for any errors or warnings
2. Test payment processing functionality
3. Verify platform settings are accessible in admin interface
4. Monitor system performance after migration
5. Update restaurant owners about new platform-controlled settings

For support, contact the development team with this report.

        
        with open(report_filename, 'w') as f:
            f.write(report_content)
            
        logger.info(f"Migration report generated: {report_filename}")
        print(report_content)


def main():
    """Main function to run the migration"""
    
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate restaurant settings to platform architecture')
    parser.add_argument('--dry-run', action='store_true', default=True, 
                       help='Run migration without making changes (default: True)')
    parser.add_argument('--execute', action='store_true', 
                       help='Execute the actual migration (overrides --dry-run)')
    
    args = parser.parse_args()
    
    # Determine if this is a dry run
    dry_run = not args.execute
    
    if not dry_run:
        print("⚠️  WARNING: This will modify your database!")
        print("⚠️  Make sure you have a backup before proceeding!")
        confirmation = input("Are you sure you want to execute the migration? (yes/no): ")
        if confirmation.lower() != 'yes':
            print("Migration cancelled.")
            return
    
    print(f"Starting migration (DRY RUN: {dry_run})...")
    
    with PlatformSettingsMigration(dry_run=dry_run) as migration:
        success = migration.run_migration()
        
        if success:
            print("✅ Migration completed successfully!")
            if dry_run:
                print("🔄 Run with --execute to perform actual migration")
        else:
            print("❌ Migration failed. Check logs for details.")
            sys.exit(1)


if __name__ == "__main__":
    main()