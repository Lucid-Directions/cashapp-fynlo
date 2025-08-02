import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from decimal import Decimal

from app.models.financial_records import PlatformFeeRecord, StaffTipDistributionRecord
from app.schemas.fee_schemas import PlatformFeeRecordSchema

logger = logging.getLogger(__name__)

class FinancialRecordsService:
    """
    Service for managing financial records like platform fees and staff tip distributions.
    """

    def __init__(self, db: Session):
        self.db = db

    def create_platform_fee_record(self, fee_data: PlatformFeeRecordSchema) -> PlatformFeeRecord:
        """
        Creates and saves a platform fee record.
        """
        logger.info(f"Creating platform fee record for order: {fee_data.get('order_id')}")

        db_record = PlatformFeeRecord(
            order_reference=fee_data['order_id'], # order_id from schema maps to order_reference in model
            platform_fee_amount=Decimal(str(fee_data['platform_fee_amount'])),
            processor_fee_amount=Decimal(str(fee_data['processor_fee_amount'])),
            customer_paid_processor_fee=fee_data['customer_paid_processor'],
            payment_method=fee_data['payment_method'].value, # Store enum's value
            # transaction_timestamp is server_default in model, or can be passed in fee_data
        )
        if 'transaction_timestamp' in fee_data and fee_data['transaction_timestamp']:
            # If client provides it, use it. Ensure it's in correct format or parse.
            # For now, assuming it's already a valid datetime string if provided.
            # db_record.transaction_timestamp = parse_datetime_string(fee_data['transaction_timestamp'])
            # Simpler: let server_default handle it if not passed or passed as None.
            # Or, if model doesn't have server_default and it's mandatory from client:
            # from dateutil import parser
            # db_record.transaction_timestamp = parser.isoparse(fee_data['transaction_timestamp'])
            pass # Relying on server_default for now if not explicitly handled.

        try:
            self.db.add(db_record)
            self.db.commit()
            self.db.refresh(db_record)
            logger.info(f"Platform fee record created with ID: {db_record.id} for order {db_record.order_reference}")
            return db_record
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating platform fee record for order {fee_data.get('order_id')}: {e}", exc_info=True)
            raise

    def get_platform_fees_for_order(self, order_reference: str) -> List[PlatformFeeRecord]:
        """
        Retrieves all platform fee records for a given order reference.
        """
        return self.db.query(PlatformFeeRecord).filter(
            PlatformFeeRecord.order_reference == order_reference
        ).all()

    # StaffTipDistributionRecord methods will be used by StaffTipService or related endpoints
    # StaffTipService already handles creation of StaffTipDistributionRecord.
    # This service could provide query methods if needed outside StaffTipService.

    def get_staff_tip_distributions_for_order(self, order_reference: str) -> List[StaffTipDistributionRecord]:
        """
        Retrieves staff tip distribution records for a specific order.
        (This functionality might also live in StaffTipService)
        """
        return self.db.query(StaffTipDistributionRecord).filter(
            StaffTipDistributionRecord.order_reference == order_reference
        ).all()

    def get_staff_tip_distributions_for_staff_member(
        self,
        staff_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[StaffTipDistributionRecord]:
        """
        Retrieves staff tip distribution records for a specific staff member.
        (This functionality might also live in StaffTipService)
        """
        query = self.db.query(StaffTipDistributionRecord).filter(StaffTipDistributionRecord.staff_id == staff_id)
        if start_date:
            query = query.filter(StaffTipDistributionRecord.distribution_timestamp >= start_date)
        if end_date:
            query = query.filter(StaffTipDistributionRecord.distribution_timestamp <= end_date)
        return query.order_by(StaffTipDistributionRecord.distribution_timestamp.desc()).all()
