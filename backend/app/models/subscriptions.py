# app/models/subscriptions.py
from sqlalchemy import Column, Integer, String, DECIMAL, Boolean, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.core.database import Base

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)  # alpha, beta, omega
    display_name = Column(String(100), nullable=False)
    monthly_price = Column(DECIMAL(10, 2), nullable=False)
    features = Column(JSONB, default={})
    limits = Column(JSONB, default={})
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

class PlanFeature(Base):
    __tablename__ = "plan_features"
    
    id = Column(Integer, primary_key=True)
    feature_key = Column(String(100), unique=True, nullable=False)
    feature_name = Column(String(255), nullable=False)
    description = Column(String(500))
    category = Column(String(50))

class PlanFeatureMapping(Base):
    __tablename__ = "plan_feature_mapping"
    
    plan_id = Column(Integer, ForeignKey("subscription_plans.id"), primary_key=True)
    feature_id = Column(Integer, ForeignKey("plan_features.id"), primary_key=True)
    is_enabled = Column(Boolean, default=True)
    limit_value = Column(Integer)