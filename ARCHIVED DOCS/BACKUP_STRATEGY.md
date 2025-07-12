# Backup & Disaster Recovery Strategy - Fynlo POS

## Overview

This document outlines the backup and disaster recovery strategy for the Fynlo POS system deployed on DigitalOcean infrastructure.

---

## 🗄️ Database Backup Strategy

### PostgreSQL Backup (DigitalOcean Managed Database)

#### Automated Backups
- **Frequency**: Daily automated backups
- **Retention**: 7-day rolling retention (configurable up to 30 days)
- **Location**: DigitalOcean managed backup service
- **Time**: 2:00 AM UTC (off-peak hours)

#### Manual Backup Commands
```bash
# Create manual backup
pg_dump -h your-db-host -U your-username -d fynlo_pos > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql -h your-db-host -U your-username -d fynlo_pos < backup_file.sql
```

#### Backup Verification Script
```bash
#!/bin/bash
# backup_verify.sh
BACKUP_FILE="backup_$(date +%Y%m%d).sql"
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > $BACKUP_FILE

# Verify backup file size and integrity
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    echo "✅ Backup created successfully: $BACKUP_FILE"
    # Upload to additional storage (S3, etc.)
    # aws s3 cp $BACKUP_FILE s3://fynlo-backups/database/
else
    echo "❌ Backup failed"
    exit 1
fi
```

---

## 💾 Redis Backup Strategy

### Redis Persistence Configuration
```redis
# Redis configuration for data persistence
save 900 1      # Save after 900 seconds if at least 1 key changed
save 300 10     # Save after 300 seconds if at least 10 keys changed  
save 60 10000   # Save after 60 seconds if at least 10000 keys changed

# Enable AOF (Append Only File) for maximum durability
appendonly yes
appendfsync everysec
```

### Redis Backup Commands
```bash
# Create Redis backup
redis-cli --rdb backup_redis_$(date +%Y%m%d_%H%M%S).rdb

# Restore Redis from backup
cp backup_redis.rdb /var/lib/redis/dump.rdb
sudo systemctl restart redis
```

---

## 📂 File Storage Backup

### Application Uploads Directory
```bash
# Backup uploads directory
tar -czf uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz /app/uploads/

# Restore uploads
tar -xzf uploads_backup.tar.gz -C /
```

### Configuration Files Backup
```bash
# Backup critical configuration
tar -czf config_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  /app/.env \
  /app/docker-compose.yml \
  /app/nginx.conf \
  /app/ssl/
```

---

## 🚀 DigitalOcean App Platform Backup

### Application Source Code
- **Strategy**: Git-based deployment ensures source code backup
- **Repository**: GitHub with multiple copies
- **Branch Protection**: Main branch protected, requires PR reviews

### Environment Variables & Secrets
```bash
# Export App Platform environment variables
doctl apps list
doctl apps get-config YOUR_APP_ID > app_config_backup.yaml

# Backup environment variables (secure storage required)
echo "DATABASE_URL=$DATABASE_URL" > env_backup.txt
echo "REDIS_URL=$REDIS_URL" >> env_backup.txt
# Store in secure location (NOT version control)
```

---

## 📋 Backup Schedule & Automation

### Daily Backup Schedule
```yaml
# backup-cron.yml (GitHub Actions or server cron)
name: Daily Backup
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Database Backup
        run: |
          pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
          
      - name: Upload to Storage
        run: |
          # Upload to secure cloud storage
          aws s3 cp backup_$(date +%Y%m%d).sql s3://fynlo-backups/
          
      - name: Cleanup Old Backups
        run: |
          # Keep only last 30 days
          find . -name "backup_*.sql" -mtime +30 -delete
```

### Manual Backup Script
```bash
#!/bin/bash
# manual_backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/fynlo_backup_$DATE"

echo "🔄 Starting Fynlo POS backup..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
echo "📊 Backing up database..."
pg_dump $DATABASE_URL > $BACKUP_DIR/database.sql

# Redis backup
echo "💾 Backing up Redis..."
redis-cli --rdb $BACKUP_DIR/redis.rdb

# Application files
echo "📂 Backing up application files..."
tar -czf $BACKUP_DIR/uploads.tar.gz /app/uploads/

# Configuration backup
echo "⚙️ Backing up configuration..."
cp /app/.env $BACKUP_DIR/env.backup
cp /app/docker-compose.yml $BACKUP_DIR/

# Create archive
echo "📦 Creating backup archive..."
tar -czf fynlo_backup_$DATE.tar.gz -C /tmp fynlo_backup_$DATE

echo "✅ Backup completed: fynlo_backup_$DATE.tar.gz"
```

---

## 🔄 Disaster Recovery Procedures

### Database Recovery
```bash
# 1. Stop application
docker-compose down

# 2. Restore database
psql $DATABASE_URL < backup_database.sql

# 3. Verify data integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM restaurants;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM orders;"

# 4. Restart application
docker-compose up -d
```

### Complete System Recovery
```bash
# 1. Deploy new DigitalOcean App Platform instance
doctl apps create --spec app_config_backup.yaml

# 2. Restore database
psql $NEW_DATABASE_URL < backup_database.sql

# 3. Restore Redis data
redis-cli --rdb < backup_redis.rdb

# 4. Restore application files
tar -xzf uploads_backup.tar.gz -C /new/app/path/

# 5. Update DNS/load balancer to point to new instance
```

---

## 🎯 Recovery Time Objectives (RTO)

| Component | Target RTO | Maximum Acceptable Data Loss |
|-----------|------------|------------------------------|
| Database | 4 hours | 24 hours |
| Redis Cache | 30 minutes | 1 hour |
| Application | 2 hours | 0 (git-based) |
| File Uploads | 2 hours | 24 hours |
| **Overall System** | **4 hours** | **24 hours** |

---

## 🧪 Backup Testing & Validation

### Monthly Backup Tests
```bash
#!/bin/bash
# test_backup_restore.sh

# Create test environment
docker run -d --name test-postgres postgres:15
docker run -d --name test-redis redis:7

# Restore latest backup to test environment
pg_dump production_db | psql test_db

# Validate data integrity
TEST_COUNT=$(psql test_db -t -c "SELECT COUNT(*) FROM orders;")
PROD_COUNT=$(psql production_db -t -c "SELECT COUNT(*) FROM orders;")

if [ "$TEST_COUNT" -eq "$PROD_COUNT" ]; then
    echo "✅ Backup restore test PASSED"
else
    echo "❌ Backup restore test FAILED"
    exit 1
fi

# Cleanup test environment
docker rm -f test-postgres test-redis
```

### Backup Validation Checklist
- [ ] Database backup file exists and is not empty
- [ ] Redis backup can be loaded successfully  
- [ ] Application files backup includes all uploads
- [ ] Configuration backup includes all environment variables
- [ ] Backup can be restored to test environment
- [ ] Restored data passes integrity checks
- [ ] Backup process completes within time limits

---

## 📊 Monitoring & Alerting

### Backup Monitoring Script
```python
# backup_monitor.py
import os
from datetime import datetime, timedelta
import smtplib

def check_backup_freshness():
    backup_dir = "/backups"
    max_age = timedelta(hours=25)  # Alert if no backup in 25 hours
    
    latest_backup = None
    for file in os.listdir(backup_dir):
        if file.startswith("backup_"):
            file_time = datetime.fromtimestamp(os.path.getmtime(f"{backup_dir}/{file}"))
            if not latest_backup or file_time > latest_backup:
                latest_backup = file_time
    
    if not latest_backup or datetime.now() - latest_backup > max_age:
        send_alert("🚨 Backup Alert: No recent backup found!")
        return False
    
    return True

def send_alert(message):
    # Send email/Slack notification
    print(f"ALERT: {message}")
```

### Health Check Integration
```python
# Add to app/main.py health check
@app.get("/health/backup")
async def backup_health():
    backup_status = check_backup_freshness()
    return {
        "backup_system": "healthy" if backup_status else "degraded",
        "last_backup": get_last_backup_time(),
        "next_scheduled": "02:00 UTC daily"
    }
```

---

## 🔐 Security Considerations

### Backup Encryption
```bash
# Encrypt backup before storage
gpg --symmetric --cipher-algo AES256 backup_database.sql

# Decrypt backup
gpg --decrypt backup_database.sql.gpg > backup_database.sql
```

### Access Control
- Backup files stored in secure, access-controlled locations
- Encryption keys managed separately from backup files
- Regular access audit for backup storage systems
- Multi-factor authentication for backup system access

---

## 📞 Emergency Contact Information

### Backup & Recovery Team
- **Primary**: System Administrator (24/7)
- **Secondary**: DevOps Engineer (business hours)
- **Escalation**: CTO/Technical Lead

### Service Providers
- **DigitalOcean Support**: [Support Portal](https://cloud.digitalocean.com/support)
- **Database Team**: Internal team for complex recovery scenarios

---

## 📋 Implementation Checklist

### Immediate (Week 1)
- [ ] Configure DigitalOcean managed database daily backups
- [ ] Set up manual backup scripts
- [ ] Test database restore procedure
- [ ] Document emergency contacts

### Short-term (Week 2-3)
- [ ] Implement automated backup monitoring
- [ ] Set up backup alerts and notifications
- [ ] Create backup testing schedule
- [ ] Configure backup encryption

### Long-term (Month 2)
- [ ] Implement cross-region backup replication
- [ ] Set up automated disaster recovery testing
- [ ] Create comprehensive runbooks
- [ ] Train team on recovery procedures

---

*Last Updated: January 7, 2025*  
*Next Review: After production deployment*  
*Status: Ready for implementation*