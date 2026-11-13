from sqlalchemy.orm import Session
from app.models import Bid, Supplier
from app.clock import ensure_utc


def compute_ranking(db: Session, rfq_id: int) -> list[dict]:
    rows = (
        db.query(Bid, Supplier.name)
        .join(Supplier, Bid.supplier_id == Supplier.id)
        .filter(Bid.rfq_id == rfq_id)
        .order_by(Bid.created_at.desc(), Bid.id.desc())
        .all()
    )

    latest_by_supplier = {}
    for bid, supplier_name in rows:
        if bid.supplier_id not in latest_by_supplier:
            latest_by_supplier[bid.supplier_id] = (bid, supplier_name)

    entries = sorted(
        latest_by_supplier.values(),
        key=lambda item: (item[0].total_price, ensure_utc(item[0].created_at), item[0].id),
    )

    return [
        {
            "rank": f"L{i}",
            "supplier_id": bid.supplier_id,
            "supplier_name": name,
            "bid_id": bid.id,
            "total_price": bid.total_price,
            "created_at": ensure_utc(bid.created_at),
        }
        for i, (bid, name) in enumerate(entries, start=1)
    ]

