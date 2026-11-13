import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRfqs } from "../api/client";

function formatLocalTime(iso) {
  return new Date(iso).toLocaleString();
}

function statusClass(status) {
  if (status === "Active") return "badge badge-active";
  if (status === "Upcoming") return "badge badge-upcoming";
  if (status === "Force Closed") return "badge badge-forced";
  return "badge badge-closed";
}

export default function RfqList() {
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getRfqs()
      .then(setRfqs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading RFQs...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>British Auctions</h1>
      {rfqs.length === 0 ? (
        <p>No RFQs yet. Create one to get started.</p>
      ) : (
        <table className="rfq-table">
          <thead>
            <tr>
              <th>RFQ Name / ID</th>
              <th>Current Lowest Bid</th>
              <th>Current Bid Close Time</th>
              <th>Forced Close Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rfqs.map((rfq) => (
              <tr
                key={rfq.id}
                className="clickable-row"
                onClick={() => navigate(`/rfqs/${rfq.id}`)}
              >
                <td>
                  <div className="rfq-name">{rfq.name}</div>
                  <div className="rfq-ref">{rfq.reference_id}</div>
                </td>
                <td>{rfq.lowest_bid !== null ? rfq.lowest_bid : "No bids yet"}</td>
                <td>{formatLocalTime(rfq.bid_close_time)}</td>
                <td>{formatLocalTime(rfq.forced_bid_close_time)}</td>
                <td>
                  <span className={statusClass(rfq.status)}>{rfq.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

