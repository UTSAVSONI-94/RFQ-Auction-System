# Database Schema

Database: PostgreSQL (`rfq_auction`)

## Relationships

- `rfqs` has many `bids` and `activity_logs`.
- `suppliers` has many `bids`.
- `bids` links an `rfq` to a `supplier`.

```
rfqs (1) --------< bids >-------- (1) suppliers
  |
  +--------< activity_logs
```

---

## Tables

### 1. `rfqs`
Stores auction configuration, dates, and closing deadlines.

- `id`: integer, primary key, autoincrement
- `reference_id`: varchar(100), unique, not null (e.g. "RFQ-101")
- `name`: varchar(255), not null
- `bid_start_time`: timestamptz, not null
- `bid_close_time`: timestamptz, not null (this gets pushed forward when extended)
- `original_close_time`: timestamptz, not null (saved at creation time)
- `forced_bid_close_time`: timestamptz, not null (hard limit, extensions cap here)
- `pickup_date`: timestamptz, not null
- `trigger_window_minutes`: integer, not null (X)
- `extension_minutes`: integer, not null (Y)
- `trigger_type`: varchar enum, not null (`ANY_BID`, `ANY_RANK_CHANGE`, `L1_CHANGE`)

### 2. `suppliers`
Stores carrier names.

- `id`: integer, primary key, autoincrement
- `name`: varchar(255), unique, not null (case-insensitive lookup when bidding)

### 3. `bids`
Keeps a full history of all submitted quotes.

- `id`: integer, primary key, autoincrement
- `rfq_id`: integer, foreign key -> rfqs(id), not null
- `supplier_id`: integer, foreign key -> suppliers(id), not null
- `freight_charges`: numeric(12,2), not null
- `origin_charges`: numeric(12,2), not null
- `destination_charges`: numeric(12,2), not null
- `total_price`: numeric(12,2), not null (freight + origin + destination)
- `transit_time`: integer, not null (days)
- `quote_validity`: timestamptz, not null
- `created_at`: timestamptz, not null (used as tie-breaker)

### 4. `activity_logs`
Audit log for auction events.

- `id`: integer, primary key, autoincrement
- `rfq_id`: integer, foreign key -> rfqs(id), not null
- `event_type`: varchar enum (`BID_PLACED`, `TIME_EXTENDED`, `EXTENSION_SKIPPED`)
- `description`: text, not null
- `old_close_time`: timestamptz, nullable (for extension events)
- `new_close_time`: timestamptz, nullable (for extension events)
- `created_at`: timestamptz, not null

---

## Decisions

- **Pre-computed `total_price`**: storing the total sum on the row avoids recalculating on every ranking query. Numeric(12,2) prevents floating point rounding weirdness.
- **No status column**: auction status (Upcoming / Active / Closed / Force Closed) is determined from current UTC time vs the dates on the RFQ. Storing it in a column would mean running cron jobs or background tasks just to keep it in sync.
- **Separate suppliers table**: keeps carrier names consistent and avoids duplicate strings. Looked up case-insensitively or created on the first bid.
- **Tie-breaker**: if two suppliers quote the same total price, the earlier `created_at` timestamp gets the better rank.
