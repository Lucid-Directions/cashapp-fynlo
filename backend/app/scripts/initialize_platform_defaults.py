#!/usr/bin/env python3
"""
Platform Defaults Initialization Script
Sets up the platform with production-ready default configurations
Safe to run multiple times - will not overwrite existing configurations
"""

import os
import sys
import logging
from datetime import datetime
from typing import Dict, Any, List

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.platform_config import (
    PlatformConfiguration, 
    PlatformFeatureFlag,
    DEFAULT_PLATFORM_CONFIGS,
    DEFAULT_FEATURE_FLAGS
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

class PlatformDefaultsInitializer:
    """Initializes platform with production-ready default configurations"""
    
    def __init__(self, update_existing: bool = False):
        self.update_existing = update_existing
        self.db = SessionLocal()
        self.stats = {
            'configs_added': 0,
            'configs_updated': 0,
            'configs_skipped': 0,
            'flags_added': 0,
            'flags_updated': 0,
            'flags_skipped': 0,
            'errors': 0
        }
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self.db.commit()
            logger.info("Platform initialization completed successfully")
        else:
            self.db.rollback()
            logger.error("Platform initialization failed - changes rolled back")
        self.db.close()
    
    def initialize(self) -> bool:
        """Initialize platform with all default configurations"""
        
        logger.info("Starting platform defaults initialization...")
        
        try:
            # Initialize platform configurations
            logger.info("Initializing platform configurations...")
            self.initialize_platform_configs()
            
            # Initialize feature flags
            logger.info("Initializing feature flags...")
            self.initialize_feature_flags()
            
            # Generate initialization report
            self.generate_report()
            
            if self.stats['errors'] == 0:
                logger.info("✅ Platform initialization completed successfully!")
                return True
            else:
                logger.warning(f"⚠️ Platform initialization completed with {self.stats['errors']} errors")
                return False
                
        except Exception as e:
            logger.error(f"Platform initialization failed: {e}", exc_info=True)
            self.stats['errors'] += 1
            return False
    
    def initialize_platform_configs(self) -> None:
        """Initialize all platform configurations"""
        
        for config_data in DEFAULT_PLATFORM_CONFIGS:
            try:
                existing = self.db.query(PlatformConfiguration).filter(
                    PlatformConfiguration.config_key == config_data['config_key']
                ).first()
                
                if existing:
                    if self.update_existing:
                        # Update existing configuration
                        for key, value in config_data.items():
                            if key != 'id':
                                setattr(existing, key, value)
                        existing.updated_at = datetime.utcnow()
                        existing.updated_by = 'initialization_script'
                        
                        self.stats['configs_updated'] += 1
                        logger.info(f"Updated platform config: {config_data['config_key']}")
                    else:
                        self.stats['configs_skipped'] += 1
                        logger.info(f"Skipped existing config: {config_data['config_key']}")
                else:
                    # Add new configuration
                    config = PlatformConfiguration(**config_data)
                    self.db.add(config)
                    
                    self.stats['configs_added'] += 1
                    logger.info(f"Added platform config: {config_data['config_key']}")
                    
            except Exception as e:
                logger.error(f"Failed to initialize config {config_data['config_key']}: {e}")
                self.stats['errors'] += 1
    
    def initialize_feature_flags(self) -> None:
        """Initialize all feature flags"""
        
        for flag_data in DEFAULT_FEATURE_FLAGS:
            try:
                existing = self.db.query(PlatformFeatureFlag).filter(
                    PlatformFeatureFlag.feature_key == flag_data['feature_key']
                ).first()
                
                if existing:
                    if self.update_existing:
                        # Update existing feature flag
                        for key, value in flag_data.items():
                            if key != 'id':
                                setattr(existing, key, value)
                        existing.updated_at = datetime.utcnow()
                        
                        self.stats['flags_updated'] += 1
                        logger.info(f"Updated feature flag: {flag_data['feature_key']}")
                    else:
                        self.stats['flags_skipped'] += 1
                        logger.info(f"Skipped existing flag: {flag_data['feature_key']}")
                else:
                    # Add new feature flag
                    flag = PlatformFeatureFlag(**flag_data)
                    self.db.add(flag)
                    
                    self.stats['flags_added'] += 1
                    logger.info(f"Added feature flag: {flag_data['feature_key']}")
                    
            except Exception as e:
                logger.error(f"Failed to initialize flag {flag_data['feature_key']}: {e}")
                self.stats['errors'] += 1
    
    def generate_report(self) -> None:
        """Generate initialization report"""
        
        report = f"""
PLATFORM DEFAULTS INITIALIZATION REPORT
========================================
Date: {datetime.now().isoformat()}
Update Existing: {self.update_existing}

PLATFORM CONFIGURATIONS:
- Added: {self.stats['configs_added']}
- Updated: {self.stats['configs_updated']}
- Skipped: {self.stats['configs_skipped']}

FEATURE FLAGS:
- Added: {self.stats['flags_added']}
- Updated: {self.stats['flags_updated']}
- Skipped: {self.stats['flags_skipped']}

TOTAL ERRORS: {self.stats['errors']}

DATABASE STATE:
- Total Platform Configs: {self.db.query(PlatformConfiguration).count()}
- Total Feature Flags: {self.db.query(PlatformFeatureFlag).count()}

STATUS: {'SUCCESS' if self.stats['errors'] == 0 else 'COMPLETED WITH ERRORS'}
"""
        
                logger.info("Platform initialization report generated")


def main():
    """Main function to run the initialization"""
    
    import argparse
    
    parser = argparse.ArgumentParser(description='Initialize platform with default configurations')
    parser.add_argument('--update-existing', action='store_true',
                       help='Update existing configurations instead of skipping them')
    
    args = parser.parse_args()
    
    if args.update_existing:
                confirmation = input("Are you sure you want to update existing configs? (yes/no): ")
        if confirmation.lower() != 'yes':
                        return
    
        with PlatformDefaultsInitializer(update_existing=args.update_existing) as initializer:
        success = initializer.initialize()
        
        if success:
                    else:
                        sys.exit(1)


if __name__ == "__main__":
    main()