# Platform Settings Migration Guide

## Overview

This guide provides step-by-step instructions for migrating from restaurant-controlled to platform-controlled payment settings architecture.

## ⚠️ Critical Prerequisites

### 1. Backup Requirements
- **MANDATORY**: Create full database backup before starting
- **MANDATORY**: Create application backup
- **RECOMMENDED**: Test backup restoration process

### 2. System Requirements
- PostgreSQL database accessible
- Python environment with all dependencies installed
- Alembic migrations up to date (prior to platform settings migration)
- Low-traffic maintenance window (recommended 2-4 hours)

### 3. Access Requirements
- Database admin access
- Application admin access
- Platform owner account configured

## Migration Process

### Phase 1: Preparation (15 minutes)

1. **Verify System State**
   ```bash
   cd /path/to/fynlo/backend
   python3 -c "from app.core.database import SessionLocal; print('✅ Database accessible')"
   alembic current
   ```

2. **Create Backup**
   ```bash
   # Database backup (adjust for your PostgreSQL setup)
   pg_dump fynlo_pos > backup_$(date +%Y%m%d_%H%M%S).sql
   
   # Application backup
   tar -czf app_backup_$(date +%Y%m%d_%H%M%S).tar.gz ../
   ```

3. **Review Current Settings**
   ```bash
   python3 app/scripts/migrate_to_platform_settings.py --dry-run
   ```

### Phase 2: Database Schema Migration (5 minutes)

1. **Run Schema Migration**
   ```bash
   alembic upgrade head
   ```

2. **Verify New Tables**
   ```sql
   \dt platform_*
   -- Should show:
   -- platform_configurations
   -- platform_feature_flags
   \dt *override*
   -- Should show:
   -- restaurant_overrides
   \dt *audit*
   -- Should show:
   -- configuration_audit
   ```

### Phase 3: Platform Initialization (5 minutes)

1. **Initialize Platform Defaults**
   ```bash
   python3 app/scripts/initialize_platform_defaults.py
   ```

2. **Verify Initialization**
   ```sql
   SELECT category, COUNT(*) FROM platform_configurations GROUP BY category;
   SELECT COUNT(*) FROM platform_feature_flags;
   ```

### Phase 4: Data Migration (15-30 minutes)

1. **Run Migration Script**
   ```bash
   python3 app/scripts/migrate_to_platform_settings.py --execute
   ```

2. **Monitor Progress**
   - Watch logs for any errors
   - Note restaurants processed
   - Note overrides created

### Phase 5: Validation (10 minutes)

1. **Run Validation Script**
   ```bash
   python3 app/scripts/validate_migration.py
   ```

2. **Manual Verification**
   ```sql
   -- Check platform settings
   SELECT config_key, category FROM platform_configurations ORDER BY category;
   
   -- Check restaurant overrides
   SELECT restaurant_id, config_key, override_value FROM restaurant_overrides;
   
   -- Check audit trail
   SELECT config_type, COUNT(*) FROM configuration_audit GROUP BY config_type;
   ```

### Phase 6: Testing (30 minutes)

1. **API Testing**
   ```bash
   # Test platform settings API
   curl -X GET http://localhost:8000/api/v1/platform-settings/settings
   
   # Test payment fee calculation
   curl -X POST http://localhost:8000/api/v1/platform-settings/payment-fees/calculate?amount=100
   ```

2. **Frontend Testing**
   - Access platform owner dashboard
   - Verify settings tab appears
   - Test payment fee display
   - Test restaurant override interface

3. **Payment Processing Testing**
   - Process test payments with each method
   - Verify fees are calculated correctly
   - Confirm no payment disruption

## Quick Migration (Automated)

For streamlined migration, use the automated script:

```bash
cd /path/to/fynlo/backend
./app/scripts/run_migration.sh
```

This script will:
- ✅ Check prerequisites
- ✅ Create backups
- ✅ Run dry run validation
- ✅ Execute complete migration
- ✅ Validate results
- ✅ Generate reports

## Post-Migration Tasks

### 1. Update Team Documentation
- [ ] Update API documentation
- [ ] Update admin procedures
- [ ] Update restaurant onboarding docs

### 2. Monitor System Health
- [ ] Monitor database performance
- [ ] Monitor API response times
- [ ] Monitor payment processing success rates

### 3. User Communication
- [ ] Notify platform administrators
- [ ] Inform restaurant owners of new override capabilities
- [ ] Update support documentation

## Rollback Procedure

If migration fails or issues are discovered:

### Immediate Rollback (Database)
```bash
# Restore database backup
psql fynlo_pos < backup_YYYYMMDD_HHMMSS.sql

# Rollback alembic migration
alembic downgrade -1
```

### Application Rollback
```bash
# Restore application files
tar -xzf app_backup_YYYYMMDD_HHMMSS.tar.gz

# Restart services
systemctl restart fynlo-backend
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors
```
ERROR: connection to server at "localhost", port 5432 failed
```
**Solution**: Verify PostgreSQL is running and accessible

#### 2. Migration Script Fails
```
ERROR: ModuleNotFoundError: No module named 'app'
```
**Solution**: Run scripts from backend directory with proper Python path

#### 3. Validation Errors
```
ERROR: Platform setting 'payment.fees.stripe' not found
```
**Solution**: Re-run platform defaults initialization

#### 4. API Errors After Migration
```
500 Internal Server Error
```
**Solution**: 
- Check application logs
- Verify database schema
- Restart application services

### Getting Help

1. **Check Migration Logs**
   ```bash
   tail -f migration_*.log
   tail -f validation_report_*.txt
   ```

2. **Database Investigation**
   ```sql
   -- Check recent audit records
   SELECT * FROM configuration_audit 
   WHERE changed_at > NOW() - INTERVAL '1 hour' 
   ORDER BY changed_at DESC;
   
   -- Check migration status
   SELECT config_key, config_value FROM platform_configurations 
   WHERE config_key LIKE '%migration%';
   ```

3. **Contact Support**
   - Include migration report
   - Include validation report
   - Include application logs
   - Specify error symptoms

## Success Criteria

Migration is considered successful when:

- ✅ All validation tests pass
- ✅ Platform settings API responds correctly
- ✅ Payment processing functions normally
- ✅ Frontend platform interface works
- ✅ Restaurant override interface functions
- ✅ No payment method disruption
- ✅ Audit trail is complete

## Security Notes

### Sensitive Data Handling
- Payment provider API keys remain restaurant-controlled
- Platform fees are now centrally managed
- Restaurant overrides require approval for sensitive changes

### Access Control
- Platform settings require admin role
- Restaurant overrides limited by platform policy
- Full audit trail for all changes

### Compliance
- All configuration changes are audited
- Restaurant data remains isolated
- Platform fee changes are logged and traceable

## Performance Impact

### Expected Changes
- **Database**: Additional tables and indices (minimal impact)
- **API**: New endpoints for platform settings
- **Frontend**: New platform settings interface
- **Payment Processing**: No change in processing time

### Monitoring
- Monitor database query performance
- Track API response times
- Watch payment processing success rates
- Monitor memory usage patterns

## Maintenance

### Regular Tasks
- Monitor audit trail size and performance
- Review restaurant override requests
- Update platform fee configurations as needed
- Backup platform settings regularly

### Quarterly Reviews
- Review platform fee structure
- Analyze restaurant override patterns
- Update platform policies as needed
- Performance optimization

---

**Migration Support**: For assistance during migration, contact the development team with your migration reports and system logs.