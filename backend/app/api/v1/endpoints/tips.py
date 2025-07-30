from fastapi import APIRouter, Depends, Body, Path
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas.fee_schemas import StaffMember, StaffTipDistribution, StaffTipDistributionRecordSchema
from app.services.staff_tip_service import StaffTipService
from app.models.financial_records import StaffTipDistributionRecord
from pydantic import BaseModel, Field
from app.core.exceptions import BusinessLogicException, FynloException, ValidationException
router = APIRouter()

def get_staff_tip_service_dep(db: Session=Depends(get_db)) -> StaffTipService:
    return StaffTipService(db=db)

class TipDistributionRequestInput(BaseModel):
    total_tips_collected: float = Field(..., ge=0)
    service_charge_amount_on_order: float = Field(..., ge=0)
    processor_fee_covered_by_service_charge: float = Field(..., ge=0)
    assigned_staff: List[StaffMember]
    tip_distribution_strategy: Optional[str] = 'equal_split'

def convert_db_tip_dist_to_schema(record: StaffTipDistributionRecord) -> StaffTipDistributionRecordSchema:
    return StaffTipDistributionRecordSchema(id=record.id, order_id=record.order_reference, staff_id=record.staff_id, tip_amount_gross=float(record.tip_amount_gross), service_charge_deduction=float(record.service_charge_deduction), transaction_fee_impact_on_tip=float(record.transaction_fee_impact_on_tip), tip_amount_net=float(record.tip_amount_net), distribution_timestamp=record.distribution_timestamp.isoformat())

@router.post('/orders/{order_reference}/distribute-tips', response_model=List[StaffTipDistribution])
def trigger_tip_distribution(order_reference: str=Path(..., description='The reference ID of the order for which tips are being distributed.'), request_data: TipDistributionRequestInput=Body(...), service: StaffTipService=Depends(get_staff_tip_service_dep)):
    """
    Distributes tips for a given order to the assigned staff members and records the distribution.
    Returns the breakdown of how tips were allocated per staff member.
    """
    if not request_data.assigned_staff and request_data.total_tips_collected > 0:
        raise BusinessLogicException(message='Cannot distribute tips: No staff members assigned to the order.', code='OPERATION_NOT_ALLOWED')
    try:
        distributions = service.distribute_order_tips(order_reference=order_reference, total_tips_collected=request_data.total_tips_collected, service_charge_amount_on_order=request_data.service_charge_amount_on_order, processor_fee_covered_by_service_charge=request_data.processor_fee_covered_by_service_charge, assigned_staff=request_data.assigned_staff, tip_distribution_strategy=request_data.tip_distribution_strategy or 'equal_split')
        return distributions
    except ValueError as ve:
        raise ValidationException(message='', code='BAD_REQUEST')
    except Exception as e:
        raise FynloException(message='', code='INTERNAL_ERROR')

@router.get('/orders/{order_reference}/tip-distributions', response_model=List[StaffTipDistributionRecordSchema])
def get_tip_distributions_for_order_api(order_reference: str=Path(..., description='The reference ID of the order.'), service: StaffTipService=Depends(get_staff_tip_service_dep)):
    """
    Retrieves all recorded tip distributions for a specific order.
    """
    db_records = service.get_tip_distributions_for_order(order_reference=order_reference)
    return [convert_db_tip_dist_to_schema(rec) for rec in db_records]

@router.get('/staff/{staff_id}/tip-distributions', response_model=List[StaffTipDistributionRecordSchema])
def get_tip_distributions_for_staff_api(staff_id: str=Path(..., description='The ID of the staff member.'), start_date: Optional[str]=None, end_date: Optional[str]=None, service: StaffTipService=Depends(get_staff_tip_service_dep)):
    """
    Retrieves all recorded tip distributions for a specific staff member,
    optionally filtered by a date range (ISO format dates expected).
    """
    db_records = service.get_tip_distributions_for_staff(staff_id=staff_id, start_date=start_date, end_date=end_date)
    return [convert_db_tip_dist_to_schema(rec) for rec in db_records]