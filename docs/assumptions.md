# Assumptions

## Stage 1 — models and db setup

- Using FastAPI + SQLAlchemy + PostgreSQL. Database name is `rfq_auction`.
- psycopg2 as the driver (not psycopg3) since that's what we installed. Connection string uses `postgresql+psycopg2://`.
- Loading `.env` with `python-dotenv` in `database.py`, and keeping `.env.example` committed with `DATABASE_URL`.
- Tables get created on app startup via `Base.metadata.create_all(bind=engine)` — no Alembic for now.
- Four tables: `rfqs`, `suppliers`, `bids`, `activity_logs`. Nothing else.
- `total_price` is stored on the bid row itself (freight + origin + destination), computed at insert time. Easier to query/sort than computing it every time.
- All money columns are NUMERIC(12,2). No floats.
- `transit_time` is an integer (days). The assignment says "transit time" but doesn't specify units, days seemed reasonable.
- `quote_validity` is a datetime — the date until which the quote is valid.
- `trigger_type` is a postgres enum with three values: `ANY_BID`, `ANY_RANK_CHANGE`, `L1_CHANGE`. Maps 1:1 to the three extension triggers in the assignment.
- `activity_logs.event_type` is a postgres enum allowing `BID_PLACED`, `TIME_EXTENDED`, and `EXTENSION_SKIPPED`.
- Status (active/closed/force closed/upcoming) is NOT a column. It gets computed from timestamps when queried. No point storing something that changes with time.
- `suppliers` is its own table. The assignment says "Carrier Name" on the quote form, so suppliers need to exist before they can bid. Keeping it separate avoids duplicating names across bids.
- All timestamps are timezone-aware (`DateTime(timezone=True)`), stored in UTC.
- `created_at` on bids is what decides tie-breaking — earlier timestamp wins.

## Stage 2 — CORS, schemas, and POST /rfqs

- Updated the `rfqs` model to match the exact Stage 2 fields: `reference_id` (unique), `name`, `original_close_time`, and `extension_minutes` (renamed from `rfq_name` and `extension_duration_minutes`).
- `original_close_time` gets set to `bid_close_time` when the RFQ is created, so later when extensions push `bid_close_time` forward, we still remember what the original close time was.
- All incoming datetimes must be timezone-aware (naive datetimes fail with 422). When they pass validation, we convert them to UTC so everything stored in the db is consistently UTC.
- `POST /rfqs` returns 201 on create and 409 if `reference_id` already exists.
- CORS only allows `http://localhost:5173` (Vite dev server).

## Stage 3 — clock, ranking, and status helpers

- `clock.py` gives us `get_now()` and `ensure_utc(dt)` so every timestamp comparison runs in UTC, even if a db driver or test passes a naive datetime.
- `compute_ranking(db, rfq_id)` grabs all bids for that RFQ ordered newest-first (`created_at desc, id desc`), picks the first row seen per `supplier_id`, and sorts those by `(total_price, created_at, id)`. Earlier `created_at` wins ties.
- `compute_status(rfq, now)` checks `now < bid_start_time` -> Upcoming, `now < bid_close_time` -> Active, `bid_close_time >= forced_bid_close_time` -> Force Closed, else Closed.

## Stage 4 — placing bids and extension triggers

- Everything in `place_bid` runs in a single transaction, starting with `SELECT ... FOR UPDATE` on the RFQ row so two concurrent bids near close time can't race on `bid_close_time`.
- `clock.get_now()` is called through the `clock` module (`from app import clock`) so tests can monkeypatch it easily. We also pass that same `now` as `bid.created_at` and `activity_log.created_at`.
- `carrier_name` gets stripped and matched case-insensitively (`func.lower`). If the supplier doesn't exist yet, we create it on the fly inside the same transaction.
- Before checking extension triggers, we snapshot `old_ranking`, insert the bid, then compute `new_ranking`.
- `in_window` is `bid_close_time - X <= now < bid_close_time`.
- When a trigger fires, `new_close = min(bid_close_time + Y, forced_bid_close_time)`. If `new_close > bid_close_time`, we extend and log `TIME_EXTENDED`; if we're already at `forced_bid_close_time`, we log `EXTENSION_SKIPPED`.
- `quote_validity_date` on `BidCreate` is normalized with `ensure_utc` so both aware and naive dates store cleanly as UTC.

## Stage 5 — listing and details endpoints

- Added `old_close_time` and `new_close_time` nullable columns to `activity_logs` so `TIME_EXTENDED` entries store the exact before/after timestamps cleanly instead of only embedding them in text.
- `GET /rfqs` returns auctions newest-first (`id desc`), with `lowest_bid` taken from `compute_ranking(db, rfq.id)[0]` (or `None` if no bids yet).
- `GET /rfqs/{rfq_id}` returns `server_time` (UTC) alongside the RFQ config, status, ranked latest bids (with full charge breakdown), and `activity_log` ordered oldest-first (`created_at asc, id asc`).
- Every datetime returned from both endpoints is passed through `ensure_utc` so responses always serialize as timezone-aware UTC ISO strings.

## Stage 6a — frontend setup & RFQ listing

- Vite + React with `react-router-dom` only, plain CSS.
- `src/api/client.js` reads `import.meta.env.VITE_API_URL` (defaults to `http://localhost:8000`) and wraps `fetch` with a small helper that pulls FastAPI's `detail` string out on errors.
- Routes `/` (RFQ list), `/create` (placeholder), `/rfqs/:id` (placeholder).
- Timestamps are formatted with `new Date(iso).toLocaleString()` so they display in the user's local timezone while the backend stays strictly UTC.

## Stage 6b — Create RFQ page

- `CreateRfq.jsx` uses native `<input type="datetime-local">` so users pick dates in their local time, then converts them with `.toISOString()` (UTC) before sending to `POST /rfqs`.
- Client-side checks (`bid_start_time < bid_close_time < forced_bid_close_time` and `X, Y >= 1`) run before submitting, and any server errors (like `409` duplicate `reference_id`) are shown inline.
- Redirects to `/` (the RFQ list page) after creation.

## Stage 6c — RFQ Details page

- `RfqDetails.jsx` polls `GET /rfqs/{id}` every 5 seconds with `setInterval` (cleared on unmount) and ticks a 1-second local countdown timer.
- Countdown uses `server_time - Date.now()` as an offset so it stays synced to server UTC time even if the user's system clock is skewed. Displays `"Auction ended"` when remaining time hits `<= 0`.
- Bid form is disabled unless `status === "Active"`, and converts the `<input type="date">` quote validity into a UTC midnight ISO string (`YYYY-MM-DDT00:00:00Z`).
- `L1` row in the bids table is highlighted, and `TIME_EXTENDED` entries in the activity log show `old_close_time -> new_close_time`.








