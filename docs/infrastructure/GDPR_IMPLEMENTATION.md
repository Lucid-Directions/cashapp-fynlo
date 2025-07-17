# GDPR Data Protection Implementation - Fynlo POS

## Overview

This document outlines the implementation of GDPR (General Data Protection Regulation) compliance features for the Fynlo POS system, ensuring user rights and data protection.

---

## 🏛️ GDPR Requirements & Implementation

### Article 15: Right of Access (Data Portability)

#### User Data Export Endpoint
```python
# backend/app/api/v1/gdpr.py

@router.get("/data-export")
async def export_user_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export all user data in machine-readable format"""
    
    user_data = {
        "personal_information": {
            "id": current_user.id,
            "email": current_user.email,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "phone": current_user.phone,
            "created_at": current_user.created_at.isoformat(),
            "updated_at": current_user.updated_at.isoformat(),
        },
        "profile_data": get_user_profile_data(db, current_user.id),
        "transaction_history": get_user_transactions(db, current_user.id),
        "settings_preferences": get_user_settings(db, current_user.id),
        "audit_logs": get_user_audit_logs(db, current_user.id),
    }
    
    # Create downloadable file
    filename = f"user_data_export_{current_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    return JSONResponse(
        content=user_data,
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
```

### Article 17: Right to Erasure ("Right to be Forgotten")

#### User Data Deletion Endpoint
```python
@router.delete("/delete-account")
async def delete_user_account(
    current_user: User = Depends(get_current_user),
    confirmation: AccountDeletionRequest,
    db: Session = Depends(get_db)
):
    """Permanently delete user account and all associated data"""
    
    # Verify deletion confirmation
    if confirmation.email != current_user.email:
        raise HTTPException(400, "Email confirmation required")
    
    if not confirmation.confirmed:
        raise HTTPException(400, "Deletion confirmation required")
    
    # Check for active obligations (open orders, etc.)
    active_orders = db.query(Order).filter(
        Order.user_id == current_user.id,
        Order.status.in_(["pending", "processing"])
    ).count()
    
    if active_orders > 0:
        raise HTTPException(
            400, 
            "Cannot delete account with active orders. Please complete or cancel all orders first."
        )
    
    # Begin deletion process
    deletion_log = await begin_account_deletion(db, current_user.id)
    
    return {
        "message": "Account deletion initiated",
        "deletion_id": deletion_log.id,
        "estimated_completion": "48 hours",
        "status": "processing"
    }

async def begin_account_deletion(db: Session, user_id: str):
    """Start the account deletion process"""
    
    # 1. Create deletion audit log
    deletion_log = AccountDeletionLog(
        user_id=user_id,
        requested_at=datetime.utcnow(),
        status="initiated"
    )
    db.add(deletion_log)
    
    # 2. Anonymize transaction records (keep for business/legal requirements)
    anonymize_user_transactions(db, user_id)
    
    # 3. Delete personal data
    delete_user_profile_data(db, user_id)
    delete_user_settings(db, user_id)
    delete_user_sessions(db, user_id)
    
    # 4. Remove user account
    user = db.query(User).filter(User.id == user_id).first()
    db.delete(user)
    
    deletion_log.status = "completed"
    deletion_log.completed_at = datetime.utcnow()
    
    db.commit()
    return deletion_log
```

### Article 16: Right to Rectification

#### Data Correction Endpoints
```python
@router.put("/personal-data")
async def update_personal_data(
    data_updates: PersonalDataUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update personal information"""
    
    # Log data change for audit
    audit_log = DataChangeLog(
        user_id=current_user.id,
        changed_fields=list(data_updates.dict(exclude_unset=True).keys()),
        old_values=get_current_user_data(current_user),
        new_values=data_updates.dict(exclude_unset=True),
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    
    # Update user data
    for field, value in data_updates.dict(exclude_unset=True).items():
        setattr(current_user, field, value)
    
    current_user.updated_at = datetime.utcnow()
    db.commit()
    
    return APIResponseHelper.success(
        message="Personal data updated successfully"
    )
```

### Article 21: Right to Object

#### Data Processing Consent Management
```python
@router.get("/consent-status")
async def get_consent_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current consent status for different data processing activities"""
    
    consent_record = db.query(UserConsent).filter(
        UserConsent.user_id == current_user.id
    ).first()
    
    return {
        "marketing_communications": consent_record.marketing_consent if consent_record else False,
        "analytics_tracking": consent_record.analytics_consent if consent_record else False,
        "performance_monitoring": consent_record.performance_consent if consent_record else True,
        "essential_operations": True,  # Required for service functionality
        "last_updated": consent_record.updated_at.isoformat() if consent_record else None
    }

@router.put("/consent")
async def update_consent(
    consent_updates: ConsentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update data processing consent preferences"""
    
    consent_record = db.query(UserConsent).filter(
        UserConsent.user_id == current_user.id
    ).first()
    
    if not consent_record:
        consent_record = UserConsent(user_id=current_user.id)
        db.add(consent_record)
    
    # Update consent preferences
    for field, value in consent_updates.dict(exclude_unset=True).items():
        setattr(consent_record, field, value)
    
    consent_record.updated_at = datetime.utcnow()
    db.commit()
    
    # Log consent change
    log_consent_change(db, current_user.id, consent_updates.dict())
    
    return APIResponseHelper.success(
        message="Consent preferences updated"
    )
```

---

## 🗄️ Database Schema for GDPR Compliance

### User Consent Tracking
```python
class UserConsent(Base):
    __tablename__ = "user_consents"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False)
    
    # Consent categories
    marketing_consent = Column(Boolean, default=False)
    analytics_consent = Column(Boolean, default=False)
    performance_consent = Column(Boolean, default=True)
    
    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String, nullable=True)  # For consent proof
    user_agent = Column(String, nullable=True)  # For consent proof
```

### Data Processing Audit Log
```python
class DataProcessingLog(Base):
    __tablename__ = "data_processing_logs"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False)
    
    processing_purpose = Column(String, nullable=False)  # "analytics", "marketing", etc.
    legal_basis = Column(String, nullable=False)  # "consent", "legitimate_interest", etc.
    data_categories = Column(JSON, nullable=False)  # List of data types processed
    
    timestamp = Column(DateTime, default=datetime.utcnow)
    retention_period = Column(Integer, nullable=True)  # Days
    auto_delete_date = Column(DateTime, nullable=True)
```

### Account Deletion Tracking
```python
class AccountDeletionLog(Base):
    __tablename__ = "account_deletion_logs"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID, nullable=False)  # Don't FK to deleted user
    
    requested_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String, default="initiated")  # "initiated", "processing", "completed"
    
    deletion_method = Column(String, default="user_request")
    ip_address = Column(String, nullable=True)
    retention_exceptions = Column(JSON, nullable=True)  # Legal/business reasons to retain some data
```

---

## 📱 Frontend GDPR Components

### Privacy Dashboard Component
```typescript
// src/components/gdpr/PrivacyDashboard.tsx

interface PrivacyDashboardProps {
  user: User;
}

export const PrivacyDashboard: React.FC<PrivacyDashboardProps> = ({ user }) => {
  const [consentStatus, setConsentStatus] = useState<ConsentStatus | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleDataExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/v1/gdpr/data-export', {
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my_data_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Privacy & Data Control</Text>
      
      <SettingsSection title="Your Data">
        <SettingsCard
          title="Download Your Data"
          description="Export all your personal data in a portable format"
          onPress={handleDataExport}
          loading={isExporting}
        />
        
        <SettingsCard
          title="Delete Account"
          description="Permanently delete your account and all associated data"
          onPress={() => navigation.navigate('AccountDeletion')}
          destructive
        />
      </SettingsSection>

      <ConsentManager 
        consentStatus={consentStatus}
        onConsentChange={handleConsentChange}
      />
    </View>
  );
};
```

### Account Deletion Flow
```typescript
// src/screens/gdpr/AccountDeletionScreen.tsx

export const AccountDeletionScreen: React.FC = () => {
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAccountDeletion = async () => {
    if (!confirmed || confirmationEmail !== user.email) {
      Alert.alert('Error', 'Please confirm your email address and check the confirmation box');
      return;
    }

    Alert.alert(
      'Confirm Account Deletion',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Account', 
          style: 'destructive',
          onPress: confirmDeletion
        }
      ]
    );
  };

  const confirmDeletion = async () => {
    setIsDeleting(true);
    try {
      await fetch('/api/v1/gdpr/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          email: confirmationEmail,
          confirmed: true
        })
      });

      // Log out and redirect to goodbye screen
      await logout();
      navigation.navigate('AccountDeleted');
    } catch (error) {
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.warning}>⚠️ Account Deletion Warning</Text>
      <Text style={styles.description}>
        Deleting your account will permanently remove all your personal data, 
        including orders, preferences, and profile information. This action cannot be undone.
      </Text>

      <TextInput
        placeholder="Enter your email to confirm"
        value={confirmationEmail}
        onChangeText={setConfirmationEmail}
        style={styles.input}
      />

      <ToggleSwitch
        label="I understand that this action is permanent and cannot be undone"
        value={confirmed}
        onValueChange={setConfirmed}
      />

      <Button
        title={isDeleting ? 'Deleting Account...' : 'Delete My Account'}
        onPress={handleAccountDeletion}
        disabled={!confirmed || confirmationEmail !== user.email || isDeleting}
        style={styles.deleteButton}
      />
    </SafeAreaView>
  );
};
```

---

## 🔄 Data Retention & Automated Cleanup

### Automated Data Cleanup Job
```python
# backend/app/jobs/gdpr_cleanup.py

async def automated_gdpr_cleanup():
    """Daily job to clean up expired data per GDPR requirements"""
    
    db = next(get_db_session())
    
    try:
        # 1. Delete expired user sessions (30 days)
        expired_sessions = db.query(UserSession).filter(
            UserSession.created_at < datetime.utcnow() - timedelta(days=30)
        ).delete()
        
        # 2. Anonymize old transaction data (7 years retention)
        old_transactions = db.query(Transaction).filter(
            Transaction.created_at < datetime.utcnow() - timedelta(days=2555)  # 7 years
        )
        
        for transaction in old_transactions:
            transaction.customer_email = None
            transaction.customer_name = "ANONYMIZED"
            transaction.customer_phone = None
        
        # 3. Delete marketing tracking data (2 years)
        old_marketing_data = db.query(MarketingEvent).filter(
            MarketingEvent.created_at < datetime.utcnow() - timedelta(days=730)
        ).delete()
        
        # 4. Clean up temporary export files
        cleanup_export_files()
        
        db.commit()
        
        logger.info(f"GDPR cleanup completed: {expired_sessions} sessions, {old_marketing_data} marketing events cleaned")
        
    except Exception as e:
        db.rollback()
        logger.error(f"GDPR cleanup failed: {e}")
        raise
    finally:
        db.close()

def cleanup_export_files():
    """Remove export files older than 24 hours"""
    export_dir = "/app/exports"
    cutoff_time = datetime.now() - timedelta(hours=24)
    
    for filename in os.listdir(export_dir):
        file_path = os.path.join(export_dir, filename)
        if os.path.getctime(file_path) < cutoff_time.timestamp():
            os.remove(file_path)
```

---

## 📋 Privacy Policy & Consent Management

### Cookie Consent Component
```typescript
// src/components/gdpr/CookieConsent.tsx

export const CookieConsent: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already provided consent
    const consentGiven = AsyncStorage.getItem('gdpr_consent');
    if (!consentGiven) {
      setShowBanner(true);
    }
  }, []);

  const handleAcceptAll = async () => {
    await updateConsent({
      marketing_consent: true,
      analytics_consent: true,
      performance_consent: true
    });
    setShowBanner(false);
  };

  const handleAcceptEssential = async () => {
    await updateConsent({
      marketing_consent: false,
      analytics_consent: false,
      performance_consent: true
    });
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        We use cookies to improve your experience. Essential cookies are required 
        for the app to function. Analytics and marketing cookies help us improve our service.
      </Text>
      
      <View style={styles.buttons}>
        <Button title="Accept All" onPress={handleAcceptAll} />
        <Button title="Essential Only" onPress={handleAcceptEssential} />
        <Button title="Manage Preferences" onPress={() => navigation.navigate('PrivacySettings')} />
      </View>
    </View>
  );
};
```

---

## 🎯 Implementation Checklist

### Backend Implementation
- [ ] Create GDPR API endpoints (`/api/v1/gdpr/`)
- [ ] Implement data export functionality
- [ ] Implement account deletion with audit trail
- [ ] Create consent management system
- [ ] Set up automated data cleanup jobs
- [ ] Add data retention policies to database models

### Frontend Implementation  
- [ ] Create Privacy Dashboard screen
- [ ] Implement account deletion flow
- [ ] Add consent management UI
- [ ] Create cookie consent banner
- [ ] Add privacy settings to main settings
- [ ] Implement data export functionality

### Legal & Compliance
- [ ] Update Privacy Policy with GDPR rights
- [ ] Create Terms of Service with data processing clauses
- [ ] Document legal basis for each type of data processing
- [ ] Set up Data Protection Officer contact information
- [ ] Create breach notification procedures

### Testing & Validation
- [ ] Test data export completeness
- [ ] Verify account deletion removes all personal data
- [ ] Test consent withdrawal functionality
- [ ] Validate automated cleanup processes
- [ ] Security audit of GDPR endpoints

---

## 📞 Data Protection Contacts

### Data Protection Officer (DPO)
- **Name**: [To be appointed]
- **Email**: privacy@fynlo.com
- **Role**: GDPR compliance oversight

### User Rights Requests
- **Email**: data-requests@fynlo.com
- **Response Time**: 30 days maximum
- **Available Rights**: Access, Rectification, Erasure, Portability, Object

---

## 🔚 Implementation Timeline

### Week 1: Backend Foundation
- Create database schema for consent and audit tracking
- Implement basic GDPR API endpoints
- Set up data export functionality

### Week 2: Account Management
- Implement account deletion with proper audit trail
- Create automated cleanup jobs
- Add consent management endpoints

### Week 3: Frontend Integration
- Build Privacy Dashboard
- Implement account deletion flow  
- Add consent management UI

### Week 4: Testing & Documentation
- Comprehensive testing of all GDPR features
- Update privacy policy and terms
- Complete compliance documentation

---

*Document Version: 1.0*  
*Last Updated: January 7, 2025*  
*Implementation Status: Planned*  
*Priority: Low (Post-MVP)*