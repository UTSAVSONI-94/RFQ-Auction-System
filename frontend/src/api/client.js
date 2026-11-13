const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      if (typeof err.detail === "string") {
        message = err.detail;
      } else if (Array.isArray(err.detail) && err.detail.length > 0) {
        message = err.detail.map((e) => e.msg).join(", ");
      }
    } catch {
      // ignore non-json error body
    }
    throw new Error(message);
  }

  return res.json();
}

export function getRfqs() {
  return request("/rfqs");
}

export function getRfq(id) {
  return request(`/rfqs/${id}`);
}

export function createRfq(data) {
  return request("/rfqs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function placeBid(rfqId, data) {
  return request(`/rfqs/${rfqId}/bids`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

