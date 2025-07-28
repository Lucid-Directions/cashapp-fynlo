# Fynlo POS Encryption Implementation

## Overview

This document describes the field-level encryption implementation for protecting sensitive data in the Fynlo POS system.

## Encrypted Fields

The following fields are encrypted at rest:

### User Table
- `email` - Searchable encryption (deterministic)
- `first_name` - Standard encryption
- `last_name` - Standard encryption  
- `pin_code` - Standard encryption

### Customer Table
- `email` - Searchable encryption (deterministic)
- `phone` - Searchable encryption (deterministic)
- `first_name` - Standard encryption
- `last_name` - Standard encryption

### Restaurant Table
- `phone` - Standard encryption
- `email` - Standard encryption
- `address` - JSON encryption

### Platform Table
- `owner_email` - Searchable encryption (deterministic)

### Payment Table
- `external_id` - Standard encryption (Stripe IDs, etc.)
- `payment_metadata` - JSON encryption

### QRPayment Table
- `qr_code_data` - Standard encryption

### Order Table
- `special_instructions` - Standard encryption

## Setup

### 1. Set Encryption Key

```bash
# Generate a new encryption key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Set in environment
export ENCRYPTION_MASTER_KEY="your-generated-key"
```

### 2. Run Database Migration

```bash
# Apply encryption schema changes
alembic upgrade add_field_encryption
```

### 3. Encrypt Existing Data

```bash
# Run the encryption migration script
python scripts/migrate_to_encryption.py
```

## Usage

### In Models

```python
from app.core.encryption import EncryptedString, EncryptedJSON, SearchableEncryptedString

class User(Base):
    # Standard encrypted field
    first_name = Column(EncryptedString, nullable=False)
    
    # Searchable encrypted field (for WHERE clauses)
    email = Column(SearchableEncryptedString(deterministic=True), unique=True)
    
    # Encrypted JSON field
    preferences = Column(EncryptedJSON, default={})
```

### Direct Encryption/Decryption

```python
from app.core.encryption import encrypt_field, decrypt_field

# Encrypt data
encrypted = encrypt_field("sensitive data")

# Decrypt data
decrypted = decrypt_field(encrypted)
```

## Security Considerations

### Searchable Encryption

Fields marked as "searchable" use deterministic encryption which allows:
- Equality searches (WHERE email = ?)
- Unique constraints
- Indexes

**Warning**: Deterministic encryption is less secure than standard encryption. Use only when searching is required.

### Key Management

1. **Never commit encryption keys** to version control
2. Use environment variables or secure key management service
3. Rotate keys regularly (default: 90 days)
4. Keep backups of encrypted data before key rotation

### Multi-Tenant Isolation

When `TENANT_KEY_ISOLATION` is enabled:
- Each tenant gets a unique encryption key derived from master key
- Provides additional data isolation between tenants
- Prevents cross-tenant data access even if database is compromised

## Monitoring

Check encryption status:

```sql
-- View encryption migration status
SELECT * FROM encryption_migration_status;

-- Check for unencrypted sensitive data
SELECT COUNT(*) FROM users 
WHERE email IS NOT NULL 
AND NOT is_encrypted(email);
```

## Troubleshooting

### Common Issues

1. **"ENCRYPTION_MASTER_KEY not set"**
   - Set the `ENCRYPTION_MASTER_KEY` environment variable

2. **"Failed to decrypt data"**
   - Check if using correct encryption key
   - Verify data was encrypted with same key

3. **Performance issues**
   - Consider caching decrypted values in application
   - Use searchable encryption sparingly
   - Add indexes on hash prefixes for searchable fields

### Recovery

If encryption key is lost:
1. Restore from backup tables in `encryption_backup` schema
2. Generate new encryption key
3. Re-run encryption migration

## Best Practices

1. **Minimize Searchable Fields**: Use deterministic encryption only when necessary
2. **Audit Access**: Log all access to encrypted fields
3. **Test Thoroughly**: Always test encryption/decryption in staging
4. **Monitor Performance**: Encryption adds overhead - monitor query performance
5. **Secure Key Storage**: Use AWS KMS, HashiCorp Vault, or similar in production

## Compliance

This implementation helps meet:
- GDPR requirements for data protection
- PCI DSS for payment data
- UK Data Protection Act requirements

## Future Enhancements

1. **Hardware Security Module (HSM)** integration
2. **Format Preserving Encryption (FPE)** for specific fields
3. **Homomorphic encryption** for calculations on encrypted data
4. **Automatic key rotation** with zero downtime