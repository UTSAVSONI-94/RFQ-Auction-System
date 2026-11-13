from datetime import datetime, timezone
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.models import TriggerType, ActivityEventType
from app.clock import ensure_utc


class RFQCreate(BaseModel):
    reference_id: str
    name: str
    bid_start_time: datetime
    bid_close_time: datetime
    forced_bid_close_time: datetime
    pickup_date: datetime
    trigger_window_minutes: int = Field(ge=1)
    extension_minutes: int = Field(ge=1)
    trigger_type: TriggerType

    @field_validator("bid_start_time", "bid_close_time", "forced_bid_close_time", "pickup_date")
    @classmethod
    def check_tz(cls, v: datetime):
        if v.tzinfo is None or v.tzinfo.utcoffset(v) is None:
            raise ValueError("datetime must include timezone")
        return v.astimezone(timezone.utc)

    @model_validator(mode="after")
    def check_dates(self):
        if not (self.bid_start_time < self.bid_close_time < self.forced_bid_close_time):
            raise ValueError("bid_start_time < bid_close_time < forced_bid_close_time required")
        return self


class RFQOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reference_id: str
    name: str
    bid_start_time: datetime
    bid_close_time: datetime
    original_close_time: datetime
    forced_bid_close_time: datetime
    pickup_date: datetime
    trigger_window_minutes: int
    extension_minutes: int
    trigger_type: TriggerType


class BidCreate(BaseModel):
    carrier_name: str
    freight_charges: Decimal = Field(ge=0)
    origin_charges: Decimal = Field(ge=0)
    destination_charges: Decimal = Field(ge=0)
    transit_time_days: int = Field(ge=1)
    quote_validity_date: datetime

    @field_validator("carrier_name")
    @classmethod
    def check_carrier(cls, v: str):
        v = v.strip()
        if not v:
            raise ValueError("carrier_name cannot be empty")
        return v

    @field_validator("quote_validity_date")
    @classmethod
    def normalize_validity(cls, v: datetime):
        return ensure_utc(v)


class BidOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rfq_id: int
    supplier_id: int
    freight_charges: Decimal
    origin_charges: Decimal
    destination_charges: Decimal
    total_price: Decimal
    transit_time: int
    quote_validity: datetime
    created_at: datetime


class RankItem(BaseModel):
    rank: str
    supplier_id: int
    supplier_name: str
    bid_id: int
    total_price: Decimal
    created_at: datetime


class BidResult(BaseModel):
    bid: BidOut
    ranking: list[RankItem]
    bid_close_time: datetime
    extended: bool


class RFQListItem(BaseModel):
    id: int
    reference_id: str
    name: str
    lowest_bid: Decimal | None
    bid_close_time: datetime
    forced_bid_close_time: datetime
    status: str


class DetailBidOut(BaseModel):
    rank: str
    carrier_name: str
    freight_charges: Decimal
    origin_charges: Decimal
    destination_charges: Decimal
    total_price: Decimal
    transit_time_days: int
    quote_validity_date: datetime
    created_at: datetime


class ActivityLogOut(BaseModel):
    event_type: ActivityEventType
    message: str
    old_close_time: datetime | None
    new_close_time: datetime | None
    created_at: datetime


class RFQDetailOut(BaseModel):
    id: int
    reference_id: str
    name: str
    bid_start_time: datetime
    bid_close_time: datetime
    original_close_time: datetime
    forced_bid_close_time: datetime
    pickup_date: datetime
    trigger_window_minutes: int
    extension_minutes: int
    trigger_type: TriggerType
    status: str
    server_time: datetime
    bids: list[DetailBidOut]
    activity_log: list[ActivityLogOut]
