import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from app.database import Base


class TriggerType(str, enum.Enum):
    ANY_BID = "ANY_BID"
    ANY_RANK_CHANGE = "ANY_RANK_CHANGE"
    L1_CHANGE = "L1_CHANGE"


class ActivityEventType(str, enum.Enum):
    BID_PLACED = "BID_PLACED"
    TIME_EXTENDED = "TIME_EXTENDED"
    EXTENSION_SKIPPED = "EXTENSION_SKIPPED"


class RFQ(Base):
    __tablename__ = "rfqs"

    id = Column(Integer, primary_key=True, index=True)
    reference_id = Column(String(100), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    bid_start_time = Column(DateTime(timezone=True), nullable=False)
    bid_close_time = Column(DateTime(timezone=True), nullable=False)
    original_close_time = Column(DateTime(timezone=True), nullable=False)
    forced_bid_close_time = Column(DateTime(timezone=True), nullable=False)
    pickup_date = Column(DateTime(timezone=True), nullable=False)
    trigger_window_minutes = Column(Integer, nullable=False)
    extension_minutes = Column(Integer, nullable=False)
    trigger_type = Column(Enum(TriggerType), nullable=False)

    bids = relationship("Bid", back_populates="rfq")
    activity_logs = relationship("ActivityLog", back_populates="rfq")


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)

    bids = relationship("Bid", back_populates="supplier")


class Bid(Base):
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True)
    rfq_id = Column(Integer, ForeignKey("rfqs.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    freight_charges = Column(Numeric(12, 2), nullable=False)
    origin_charges = Column(Numeric(12, 2), nullable=False)
    destination_charges = Column(Numeric(12, 2), nullable=False)
    total_price = Column(Numeric(12, 2), nullable=False)
    transit_time = Column(Integer, nullable=False)
    quote_validity = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    rfq = relationship("RFQ", back_populates="bids")
    supplier = relationship("Supplier", back_populates="bids")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    rfq_id = Column(Integer, ForeignKey("rfqs.id"), nullable=False)
    event_type = Column(Enum(ActivityEventType), nullable=False)
    description = Column(Text, nullable=False)
    old_close_time = Column(DateTime(timezone=True), nullable=True)
    new_close_time = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    rfq = relationship("RFQ", back_populates="activity_logs")
