import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getRfq, placeBid } from "../api/client";

const TRIGGER_LABELS = {
  ANY_BID: "Bid received in last X minutes",
  ANY_RANK_CHANGE: "Any supplier rank change in last X minutes",
  L1_CHANGE: "Lowest bidder (L1) rank change in last X minutes",
};

function formatTime(iso) {
  return new Date(iso).toLocaleString();
}

function statusClass(status) {
  if (status === "Active") return "badge badge-active";
  if (status === "Upcoming") return "badge badge-upcoming";
  if (status === "Force Closed") return "badge badge-forced";
  return "badge badge-closed";
}

function formatCountdown(ms) {
  if (ms <= 0) return "Auction ended";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hrs = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

export default function RfqDetails() {
  const { id } = useParams();
  const [rfq, setRfq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [offsetMs, setOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());

  const [bidForm, setBidForm] = useState({
    carrier_name: "",
    freight_charges: "",
    origin_charges: "",
    destination_charges: "",
    transit_time_days: "",
    quote_validity_date: "",
  });
  const [bidError, setBidError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRfq = useCallback(async () => {
    try {
      const data = await getRfq(id);
      setRfq(data);
      setOffsetMs(new Date(data.server_time).getTime() - Date.now());
      setLoadError("");
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRfq();
    const poll = setInterval(fetchRfq, 5000);
    return () => clearInterval(poll);
  }, [fetchRfq]);

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  function handleBidChange(e) {
    const { name, value } = e.target;
    setBidForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleBidSubmit(e) {
    e.preventDefault();
    setBidError("");
    setSubmitting(true);
    try {
      await placeBid(id, {
        carrier_name: bidForm.carrier_name.trim(),
        freight_charges: Number(bidForm.freight_charges),
        origin_charges: Number(bidForm.origin_charges),
        destination_charges: Number(bidForm.destination_charges),
        transit_time_days: Number(bidForm.transit_time_days),
        quote_validity_date: new Date(`${bidForm.quote_validity_date}T00:00:00Z`).toISOString(),
      });
      setBidForm({
        carrier_name: "",
        freight_charges: "",
        origin_charges: "",
        destination_charges: "",
        transit_time_days: "",
        quote_validity_date: "",
      });
      await fetchRfq();
    } catch (err) {
      setBidError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading RFQ details...</p>;
  if (loadError) return <p className="error">{loadError}</p>;
  if (!rfq) return null;

  const remainingMs = new Date(rfq.bid_close_time).getTime() - (nowMs + offsetMs);
  const isActive = rfq.status === "Active";

  return (
    <div className="details-stack">
      <div className="card header-row">
        <div>
          <h1>{rfq.name}</h1>
          <div className="meta-line">
            <span>Ref: <strong>{rfq.reference_id}</strong></span>
            <span>Pickup Date: <strong>{formatTime(rfq.pickup_date)}</strong></span>
          </div>
        </div>
        <div className="header-right">
          <span className={statusClass(rfq.status)}>{rfq.status}</span>
          <div className="countdown">
            <span className="countdown-label">Time to Close</span>
            <span className="countdown-value">{formatCountdown(remainingMs)}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Auction Configuration</h2>
        <div className="config-grid">
          <div><span className="label">Trigger Window (X)</span><div>{rfq.trigger_window_minutes} min</div></div>
          <div><span className="label">Extension Duration (Y)</span><div>{rfq.extension_minutes} min</div></div>
          <div className="span-2">
            <span className="label">Extension Trigger</span>
            <div>{TRIGGER_LABELS[rfq.trigger_type] || rfq.trigger_type}</div>
          </div>
          <div><span className="label">Bid Start</span><div>{formatTime(rfq.bid_start_time)}</div></div>
          <div><span className="label">Original Close</span><div>{formatTime(rfq.original_close_time)}</div></div>
          <div><span className="label">Current Close</span><div>{formatTime(rfq.bid_close_time)}</div></div>
          <div><span className="label">Forced Close</span><div>{formatTime(rfq.forced_bid_close_time)}</div></div>
        </div>
      </div>

      <div className="card">
        <h2>Supplier Bids</h2>
        {rfq.bids.length === 0 ? (
          <p className="muted">No bids yet.</p>
        ) : (
          <table className="rfq-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Carrier</th>
                <th>Freight</th>
                <th>Origin</th>
                <th>Destination</th>
                <th>Total</th>
                <th>Transit (days)</th>
                <th>Quote Validity</th>
              </tr>
            </thead>
            <tbody>
              {rfq.bids.map((b) => (
                <tr key={b.rank} className={b.rank === "L1" ? "row-l1" : ""}>
                  <td><strong>{b.rank}</strong></td>
                  <td>{b.carrier_name}</td>
                  <td>{b.freight_charges}</td>
                  <td>{b.origin_charges}</td>
                  <td>{b.destination_charges}</td>
                  <td><strong>{b.total_price}</strong></td>
                  <td>{b.transit_time_days}</td>
                  <td>{new Date(b.quote_validity_date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Place Bid</h2>
        {!isActive && (
          <p className="muted">
            Bidding is disabled because this auction is {rfq.status}.
          </p>
        )}
        <form onSubmit={handleBidSubmit} className="form-grid">
          <label>
            Carrier Name
            <input
              type="text"
              name="carrier_name"
              value={bidForm.carrier_name}
              onChange={handleBidChange}
              disabled={!isActive}
              required
            />
          </label>
          <label>
            Freight Charges
            <input
              type="number"
              name="freight_charges"
              min="0"
              step="0.01"
              value={bidForm.freight_charges}
              onChange={handleBidChange}
              disabled={!isActive}
              required
            />
          </label>
          <label>
            Origin Charges
            <input
              type="number"
              name="origin_charges"
              min="0"
              step="0.01"
              value={bidForm.origin_charges}
              onChange={handleBidChange}
              disabled={!isActive}
              required
            />
          </label>
          <label>
            Destination Charges
            <input
              type="number"
              name="destination_charges"
              min="0"
              step="0.01"
              value={bidForm.destination_charges}
              onChange={handleBidChange}
              disabled={!isActive}
              required
            />
          </label>
          <label>
            Transit Time (days)
            <input
              type="number"
              name="transit_time_days"
              min="1"
              step="1"
              value={bidForm.transit_time_days}
              onChange={handleBidChange}
              disabled={!isActive}
              required
            />
          </label>
          <label>
            Quote Validity
            <input
              type="date"
              name="quote_validity_date"
              value={bidForm.quote_validity_date}
              onChange={handleBidChange}
              disabled={!isActive}
              required
            />
          </label>
          <div className="full-width">
            <button type="submit" className="btn-primary" disabled={!isActive || submitting}>
              {submitting ? "Submitting..." : "Submit Bid"}
            </button>
          </div>
        </form>
        {bidError && <p className="error-box" style={{ marginTop: 12 }}>{bidError}</p>}
      </div>

      <div className="card">
        <h2>Activity Log</h2>
        {rfq.activity_log.length === 0 ? (
          <p className="muted">No activity yet.</p>
        ) : (
          <table className="rfq-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rfq.activity_log.map((item, idx) => (
                <tr key={idx}>
                  <td>{formatTime(item.created_at)}</td>
                  <td><code>{item.event_type}</code></td>
                  <td>
                    <div>{item.message}</div>
                    {item.old_close_time && item.new_close_time && (
                      <div className="rfq-ref">
                        {formatTime(item.old_close_time)} → {formatTime(item.new_close_time)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

