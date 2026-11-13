import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRfq } from "../api/client";

export default function CreateRfq() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    reference_id: "",
    name: "",
    bid_start_time: "",
    bid_close_time: "",
    forced_bid_close_time: "",
    pickup_date: "",
    trigger_window_minutes: 10,
    extension_minutes: 5,
    trigger_type: "ANY_BID",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const start = new Date(form.bid_start_time);
    const close = new Date(form.bid_close_time);
    const forced = new Date(form.forced_bid_close_time);
    const pickup = new Date(form.pickup_date);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(close.getTime()) ||
      Number.isNaN(forced.getTime()) ||
      Number.isNaN(pickup.getTime())
    ) {
      setError("Please fill in all date and time fields.");
      return;
    }

    if (!(start < close && close < forced)) {
      setError("Must satisfy: Bid Start Time < Bid Close Time < Forced Bid Close Time.");
      return;
    }

    const x = Number(form.trigger_window_minutes);
    const y = Number(form.extension_minutes);
    if (!Number.isInteger(x) || x < 1 || !Number.isInteger(y) || y < 1) {
      setError("Trigger window (X) and extension duration (Y) must be integers >= 1.");
      return;
    }

    setSubmitting(true);
    try {
      await createRfq({
        reference_id: form.reference_id.trim(),
        name: form.name.trim(),
        bid_start_time: start.toISOString(),
        bid_close_time: close.toISOString(),
        forced_bid_close_time: forced.toISOString(),
        pickup_date: pickup.toISOString(),
        trigger_window_minutes: x,
        extension_minutes: y,
        trigger_type: form.trigger_type,
      });
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h1>Create British Auction RFQ</h1>
      {error && <p className="error-box">{error}</p>}
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Reference ID
          <input
            type="text"
            name="reference_id"
            value={form.reference_id}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          RFQ Name
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Bid Start Time
          <input
            type="datetime-local"
            name="bid_start_time"
            value={form.bid_start_time}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Bid Close Time
          <input
            type="datetime-local"
            name="bid_close_time"
            value={form.bid_close_time}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Forced Bid Close Time
          <input
            type="datetime-local"
            name="forced_bid_close_time"
            value={form.forced_bid_close_time}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Pickup / Service Date
          <input
            type="datetime-local"
            name="pickup_date"
            value={form.pickup_date}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Trigger Window (X minutes)
          <input
            type="number"
            name="trigger_window_minutes"
            min="1"
            step="1"
            value={form.trigger_window_minutes}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Extension Duration (Y minutes)
          <input
            type="number"
            name="extension_minutes"
            min="1"
            step="1"
            value={form.extension_minutes}
            onChange={handleChange}
            required
          />
        </label>

        <label className="full-width">
          Extension Trigger Type
          <select name="trigger_type" value={form.trigger_type} onChange={handleChange}>
            <option value="ANY_BID">Bid received in last X minutes</option>
            <option value="ANY_RANK_CHANGE">Any supplier rank change in last X minutes</option>
            <option value="L1_CHANGE">Lowest bidder (L1) rank change in last X minutes</option>
          </select>
        </label>

        <div className="full-width">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Creating..." : "Create RFQ"}
          </button>
        </div>
      </form>
    </div>
  );
}

