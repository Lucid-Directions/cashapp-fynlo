"""Security dashboard API endpoints.

Provides real-time security monitoring data for platform owners.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.security_monitoring import security_monitor, ThreatLevel
from app.models.audit_log import AuditLog, AuditEventType, AuditEventStatus
from app.models.user import User
from app.core.response_helper import APIResponseHelper


router = APIRouter()


@router.get("/metrics")
async def get_security_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get real-time security metrics.
    
    Platform owners only.
    """
    # Check platform owner permission
    if current_user.role != "platform_owner":
        raise HTTPException(status_code=403, detail="Platform owner access required")
    
    # Get metrics from security monitor
    metrics = await security_monitor.get_security_metrics()
    
    # Add database metrics
    now = datetime.utcnow()
    last_hour = now - timedelta(hours=1)
    last_24h = now - timedelta(hours=24)
    
    # Failed login attempts
    failed_logins_1h = db.query(func.count(AuditLog.id)).filter(
        AuditLog.event_type == AuditEventType.LOGIN_FAILED,
        AuditLog.timestamp >= last_hour
    ).scalar()
    
    failed_logins_24h = db.query(func.count(AuditLog.id)).filter(
        AuditLog.event_type == AuditEventType.LOGIN_FAILED,
        AuditLog.timestamp >= last_24h
    ).scalar()
    
    # Unauthorized access attempts
    unauthorized_1h = db.query(func.count(AuditLog.id)).filter(
        AuditLog.event_type == AuditEventType.UNAUTHORIZED_ACCESS,
        AuditLog.timestamp >= last_hour
    ).scalar()
    
    # Add to metrics
    metrics.update({
        "failed_logins": {
            "last_hour": failed_logins_1h,
            "last_24h": failed_logins_24h
        },
        "unauthorized_access": {
            "last_hour": unauthorized_1h
        }
    })
    
    return APIResponseHelper.success(data=metrics)


@router.get("/alerts")
async def get_security_alerts(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    threat_level: Optional[ThreatLevel] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get security alerts.
    
    Platform owners only.
    """
    # Check platform owner permission
    if current_user.role != "platform_owner":
        raise HTTPException(status_code=403, detail="Platform owner access required")
    
    # For now, get alerts from audit logs
    # In production, this would query the alerts storage
    query = db.query(AuditLog).filter(
        AuditLog.event_type.in_([
            AuditEventType.LOGIN_FAILED,
            AuditEventType.UNAUTHORIZED_ACCESS,
            AuditEventType.RATE_LIMIT_EXCEEDED,
            AuditEventType.DATA_BREACH_ATTEMPT
        ])
    )
    
    # Filter by time (last 7 days)
    query = query.filter(
        AuditLog.timestamp >= datetime.utcnow() - timedelta(days=7)
    )
    
    # Order by timestamp
    query = query.order_by(desc(AuditLog.timestamp))
    
    # Pagination
    total = query.count()
    alerts = query.offset(offset).limit(limit).all()
    
    # Format alerts
    formatted_alerts = []
    for log in alerts:
        threat_level = ThreatLevel.LOW
        if log.event_type == AuditEventType.DATA_BREACH_ATTEMPT:
            threat_level = ThreatLevel.CRITICAL
        elif log.event_type == AuditEventType.UNAUTHORIZED_ACCESS:
            threat_level = ThreatLevel.HIGH
        elif log.event_type == AuditEventType.RATE_LIMIT_EXCEEDED:
            threat_level = ThreatLevel.MEDIUM
        
        formatted_alerts.append({
            "id": str(log.id),
            "timestamp": log.timestamp.isoformat(),
            "event_type": log.event_type,
            "threat_level": threat_level,
            "ip_address": log.ip_address,
            "user_id": str(log.user_id) if log.user_id else None,
            "description": log.event_description,
            "details": log.event_data
        })
    
    return APIResponseHelper.success(
        data={
            "alerts": formatted_alerts,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    )


@router.get("/audit-logs")
async def get_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    event_type: Optional[AuditEventType] = None,
    user_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get audit logs with filtering.
    
    Platform owners and restaurant owners (own data only).
    """
    query = db.query(AuditLog)
    
    # Apply role-based filtering
    if current_user.role == "restaurant_owner":
        # Restaurant owners can only see their own restaurant's logs
        query = query.filter(AuditLog.restaurant_id == current_user.restaurant_id)
    elif current_user.role != "platform_owner":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Apply filters
    if event_type:
        query = query.filter(AuditLog.event_type == event_type)
    
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    
    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)
    
    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)
    
    # Order by timestamp
    query = query.order_by(desc(AuditLog.timestamp))
    
    # Pagination
    total = query.count()
    logs = query.offset(offset).limit(limit).all()
    
    # Format logs
    formatted_logs = []
    for log in logs:
        formatted_logs.append({
            "id": str(log.id),
            "timestamp": log.timestamp.isoformat(),
            "event_type": log.event_type,
            "event_status": log.event_status,
            "user_id": str(log.user_id) if log.user_id else None,
            "user_email": log.user_email,
            "restaurant_id": str(log.restaurant_id) if log.restaurant_id else None,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "description": log.event_description,
            "data": log.event_data
        })
    
    return APIResponseHelper.success(
        data={
            "logs": formatted_logs,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    )


@router.get("/blocked-ips")
async def get_blocked_ips(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of blocked IP addresses.
    
    Platform owners only.
    """
    # Check platform owner permission
    if current_user.role != "platform_owner":
        raise HTTPException(status_code=403, detail="Platform owner access required")
    
    # Get blocked IPs from Redis
    if security_monitor.redis_client:
        blocked_ips = await security_monitor.redis_client.smembers("security:blocked_ips")
        
        # Get block details for each IP
        blocked_list = []
        for ip in blocked_ips:
            # Check if still blocked
            ttl = await security_monitor.redis_client.ttl(f"security:ip_block:{ip}")
            if ttl > 0:
                blocked_list.append({
                    "ip_address": ip.decode() if isinstance(ip, bytes) else ip,
                    "blocked_until": (
                        datetime.utcnow() + timedelta(seconds=ttl)
                    ).isoformat(),
                    "remaining_seconds": ttl
                })
        
        return APIResponseHelper.success(data={"blocked_ips": blocked_list})
    
    return APIResponseHelper.success(data={"blocked_ips": []})


@router.post("/unblock-ip")
async def unblock_ip(
    ip_address: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unblock an IP address.
    
    Platform owners only.
    """
    # Check platform owner permission
    if current_user.role != "platform_owner":
        raise HTTPException(status_code=403, detail="Platform owner access required")
    
    # Remove from blocked set
    if security_monitor.redis_client:
        await security_monitor.redis_client.srem("security:blocked_ips", ip_address)
        await security_monitor.redis_client.delete(f"security:ip_block:{ip_address}")
    
    # Log the action
    audit_log = AuditLog(
        event_type=AuditEventType.SECURITY_CONFIG_CHANGE,
        event_status=AuditEventStatus.SUCCESS,
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=ip_address,
        event_description=f"Unblocked IP address: {ip_address}",
        event_data={"action": "unblock_ip", "ip": ip_address}
    )
    db.add(audit_log)
    db.commit()
    
    return APIResponseHelper.success(
        message=f"IP address {ip_address} has been unblocked"
    )


@router.get("/security-summary")
async def get_security_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get security summary for the dashboard.
    
    Platform owners only.
    """
    # Check platform owner permission
    if current_user.role != "platform_owner":
        raise HTTPException(status_code=403, detail="Platform owner access required")
    
    now = datetime.utcnow()
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)
    last_30d = now - timedelta(days=30)
    
    # Get event counts by type
    event_summary = db.query(
        AuditLog.event_type,
        func.count(AuditLog.id).label("count")
    ).filter(
        AuditLog.timestamp >= last_24h
    ).group_by(AuditLog.event_type).all()
    
    # Get top IPs with failed logins
    top_failed_ips = db.query(
        AuditLog.ip_address,
        func.count(AuditLog.id).label("count")
    ).filter(
        AuditLog.event_type == AuditEventType.LOGIN_FAILED,
        AuditLog.timestamp >= last_24h,
        AuditLog.ip_address.isnot(None)
    ).group_by(
        AuditLog.ip_address
    ).order_by(
        desc("count")
    ).limit(10).all()
    
    # Get user activity summary
    active_users_24h = db.query(
        func.count(func.distinct(AuditLog.user_id))
    ).filter(
        AuditLog.timestamp >= last_24h,
        AuditLog.user_id.isnot(None)
    ).scalar()
    
    # Format summary
    summary = {
        "overview": {
            "active_users_24h": active_users_24h,
            "events_24h": sum(e.count for e in event_summary),
            "current_threat_level": (await security_monitor.get_security_metrics())["overall_threat_level"]
        },
        "events_by_type": {
            e.event_type: e.count for e in event_summary
        },
        "top_threat_sources": [
            {"ip": ip, "failed_attempts": count}
            for ip, count in top_failed_ips
        ],
        "trends": {
            "description": "Security trends analysis",
            "recommendation": "Review failed login attempts from top IPs"
        }
    }
    
    return APIResponseHelper.success(data=summary)