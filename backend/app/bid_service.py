from datetime import timedelta
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app import clock
from app.models import RFQ, Supplier, Bid, ActivityLog, TriggerType, ActivityEventType
from app.ranking import compute_ranking
from app.schemas import BidCreate


def place_bid(db: Session, rfq_id: int, data: BidCreate) -> dict:
    try:
        rfq = db.query(RFQ).filter(RFQ.id == rfq_id).with_for_update().first()
        if not rfq:
            raise HTTPException(status_code=404, detail="RFQ not found")

        now = clock.get_now()
        start = clock.ensure_utc(rfq.bid_start_time)
        close = clock.ensure_utc(rfq.bid_close_time)
        forced = clock.ensure_utc(rfq.forced_bid_close_time)

        if now < start:
            raise HTTPException(status_code=400, detail="Auction has not started")
        if now >= close:
            raise HTTPException(status_code=400, detail="Auction is closed")

        total_price = data.freight_charges + data.origin_charges + data.destination_charges

        supplier = (
            db.query(Supplier)
            .filter(func.lower(Supplier.name) == data.carrier_name.lower())
            .first()
        )
        if supplier:
            prev = (
                db.query(Bid)
                .filter(Bid.rfq_id == rfq_id, Bid.supplier_id == supplier.id)
                .order_by(Bid.created_at.desc(), Bid.id.desc())
                .first()
            )
            if prev and total_price >= prev.total_price:
                raise HTTPException(status_code=400, detail="Bid must be lower than your previous bid")
        else:
            supplier = Supplier(name=data.carrier_name)
            db.add(supplier)
            db.flush()

        old_ranking = compute_ranking(db, rfq_id)

        bid = Bid(
            rfq_id=rfq_id,
            supplier_id=supplier.id,
            freight_charges=data.freight_charges,
            origin_charges=data.origin_charges,
            destination_charges=data.destination_charges,
            total_price=total_price,
            transit_time=data.transit_time_days,
            quote_validity=data.quote_validity_date,
            created_at=now,
        )
        db.add(bid)
        db.flush()

        db.add(
            ActivityLog(
                rfq_id=rfq_id,
                event_type=ActivityEventType.BID_PLACED,
                description=f"{supplier.name} bid {total_price}",
                created_at=now,
            )
        )

        new_ranking = compute_ranking(db, rfq_id)

        window_start = close - timedelta(minutes=rfq.trigger_window_minutes)
        in_window = window_start <= now < close

        extended = False
        if in_window:
            fire = False
            reason = ""

            if rfq.trigger_type == TriggerType.ANY_BID:
                fire = True
                reason = f"Bid received in last {rfq.trigger_window_minutes} minutes"
            elif rfq.trigger_type == TriggerType.ANY_RANK_CHANGE:
                old_ids = [r["supplier_id"] for r in old_ranking]
                new_ids = [r["supplier_id"] for r in new_ranking]
                fire = old_ids != new_ids
                reason = f"Supplier ranking changed in last {rfq.trigger_window_minutes} minutes"
            elif rfq.trigger_type == TriggerType.L1_CHANGE:
                old_l1 = old_ranking[0]["supplier_id"] if old_ranking else None
                new_l1 = new_ranking[0]["supplier_id"] if new_ranking else None
                fire = old_l1 != new_l1
                old_name = old_ranking[0]["supplier_name"] if old_ranking else "none"
                new_name = new_ranking[0]["supplier_name"]
                reason = (
                    f"L1 (lowest bidder) changed from {old_name} to {new_name} "
                    f"in last {rfq.trigger_window_minutes} minutes"
                )

            if fire:
                new_close = min(close + timedelta(minutes=rfq.extension_minutes), forced)
                if new_close > close:
                    rfq.bid_close_time = new_close
                    extended = True
                    db.add(
                        ActivityLog(
                            rfq_id=rfq_id,
                            event_type=ActivityEventType.TIME_EXTENDED,
                            description=reason,
                            old_close_time=close,
                            new_close_time=new_close,
                            created_at=now,
                        )
                    )
                else:
                    db.add(
                        ActivityLog(
                            rfq_id=rfq_id,
                            event_type=ActivityEventType.EXTENSION_SKIPPED,
                            description="Extension skipped: forced close time reached",
                            created_at=now,
                        )
                    )

        db.commit()
        db.refresh(bid)
        db.refresh(rfq)

        return {
            "bid": bid,
            "ranking": new_ranking,
            "bid_close_time": clock.ensure_utc(rfq.bid_close_time),
            "extended": extended,
        }
    except Exception:
        db.rollback()
        raise

