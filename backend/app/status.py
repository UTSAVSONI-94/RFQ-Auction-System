from datetime import datetime
from app.clock import ensure_utc


def compute_status(rfq, now: datetime) -> str:
    now = ensure_utc(now)
    start = ensure_utc(rfq.bid_start_time)
    close = ensure_utc(rfq.bid_close_time)
    forced = ensure_utc(rfq.forced_bid_close_time)

    if now < start:
        return "Upcoming"
    if now < close:
        return "Active"
    if close >= forced:
        return "Force Closed"
    return "Closed"

