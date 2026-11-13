from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app import clock
from app.database import Base, engine, get_db
from app.models import RFQ, Bid, ActivityLog
from app.schemas import RFQCreate, RFQOut, BidCreate, BidResult, RFQListItem, RFQDetailOut
from app.bid_service import place_bid
from app.ranking import compute_ranking
from app.status import compute_status

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.post("/rfqs", response_model=RFQOut, status_code=201)
def create_rfq(data: RFQCreate, db: Session = Depends(get_db)):
    if db.query(RFQ).filter(RFQ.reference_id == data.reference_id).first():
        raise HTTPException(status_code=409, detail="reference_id already exists")

    rfq = RFQ(**data.model_dump(), original_close_time=data.bid_close_time)
    db.add(rfq)
    db.commit()
    db.refresh(rfq)
    return rfq


@app.get("/rfqs", response_model=list[RFQListItem])
def list_rfqs(db: Session = Depends(get_db)):
    now = clock.get_now()
    rfqs = db.query(RFQ).order_by(RFQ.id.desc()).all()
    items = []
    for rfq in rfqs:
        ranking = compute_ranking(db, rfq.id)
        lowest_bid = ranking[0]["total_price"] if ranking else None
        items.append(
            {
                "id": rfq.id,
                "reference_id": rfq.reference_id,
                "name": rfq.name,
                "lowest_bid": lowest_bid,
                "bid_close_time": clock.ensure_utc(rfq.bid_close_time),
                "forced_bid_close_time": clock.ensure_utc(rfq.forced_bid_close_time),
                "status": compute_status(rfq, now),
            }
        )
    return items


@app.get("/rfqs/{rfq_id}", response_model=RFQDetailOut)
def get_rfq(rfq_id: int, db: Session = Depends(get_db)):
    rfq = db.query(RFQ).filter(RFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")

    now = clock.get_now()
    ranking = compute_ranking(db, rfq.id)
    bid_ids = [r["bid_id"] for r in ranking]
    bids_by_id = {}
    if bid_ids:
        for b in db.query(Bid).filter(Bid.id.in_(bid_ids)).all():
            bids_by_id[b.id] = b

    ranked_bids = []
    for r in ranking:
        b = bids_by_id[r["bid_id"]]
        ranked_bids.append(
            {
                "rank": r["rank"],
                "carrier_name": r["supplier_name"],
                "freight_charges": b.freight_charges,
                "origin_charges": b.origin_charges,
                "destination_charges": b.destination_charges,
                "total_price": b.total_price,
                "transit_time_days": b.transit_time,
                "quote_validity_date": clock.ensure_utc(b.quote_validity),
                "created_at": clock.ensure_utc(b.created_at),
            }
        )

    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.rfq_id == rfq.id)
        .order_by(ActivityLog.created_at.asc(), ActivityLog.id.asc())
        .all()
    )
    activity_log = [
        {
            "event_type": log.event_type,
            "message": log.description,
            "old_close_time": clock.ensure_utc(log.old_close_time) if log.old_close_time else None,
            "new_close_time": clock.ensure_utc(log.new_close_time) if log.new_close_time else None,
            "created_at": clock.ensure_utc(log.created_at),
        }
        for log in logs
    ]

    return {
        "id": rfq.id,
        "reference_id": rfq.reference_id,
        "name": rfq.name,
        "bid_start_time": clock.ensure_utc(rfq.bid_start_time),
        "bid_close_time": clock.ensure_utc(rfq.bid_close_time),
        "original_close_time": clock.ensure_utc(rfq.original_close_time),
        "forced_bid_close_time": clock.ensure_utc(rfq.forced_bid_close_time),
        "pickup_date": clock.ensure_utc(rfq.pickup_date),
        "trigger_window_minutes": rfq.trigger_window_minutes,
        "extension_minutes": rfq.extension_minutes,
        "trigger_type": rfq.trigger_type,
        "status": compute_status(rfq, now),
        "server_time": now,
        "bids": ranked_bids,
        "activity_log": activity_log,
    }


@app.post("/rfqs/{rfq_id}/bids", response_model=BidResult, status_code=201)
def create_bid(rfq_id: int, data: BidCreate, db: Session = Depends(get_db)):
    return place_bid(db, rfq_id, data)
