import { useState } from "react";
import { getApiBaseUrl } from "@shared/runtimeConfig";
import { getSupaClient } from "../lib/supa";

const PLANS = [
  { key: "revise", label: "Revise", audience: "For students", price: "$8.99/mo", desc: "Upload essays, get feedback, and improve" },
  { key: "mark",   label: "Mark",   audience: "For teachers", price: "$11.99/mo", desc: "Grade student essays with detailed feedback" },
  { key: "both",   label: "Both",   audience: "Mark + Revise", price: "$14.99/mo", desc: "Full access to all features", featured: true },
];

export default function PaywallModal({ isOpen, onClose, returnPath }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSelect = async (product) => {
    setBusy(true);
    setError("");
    try {
      const supa = getSupaClient();
      const { data } = await supa.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error("Please sign in again.");
      const apiBase = getApiBaseUrl();
      const resp = await fetch(`${apiBase}/api/stripe/checkout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product, return_path: returnPath || "/profile_react.html" }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || "Could not start checkout.");
      }
      const { checkout_url } = await resp.json();
      window.location.href = checkout_url;
    } catch (err) {
      setError(err?.message || "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop paywall-modal-backdrop" onClick={onClose}>
      <div className="modal-card paywall-modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Choose a plan to continue</h3>
        <p className="paywall-modal-body">
          {"You\u2019ve reached the free tier limit. Subscribe to unlock unlimited access."}
        </p>
        <div className="upgrade-cards">
          {PLANS.map((plan) => (
            <button
              key={plan.key}
              className={`upgrade-card${plan.featured ? " upgrade-card--featured" : ""}`}
              onClick={() => handleSelect(plan.key)}
              disabled={busy}
            >
              <strong>{plan.label}</strong>
              <span className="upgrade-card-audience">{plan.audience}</span>
              <span className="upgrade-card-price">{plan.price}</span>
              <span className="upgrade-card-desc">{plan.desc}</span>
            </button>
          ))}
        </div>
        {busy && <p className="paywall-modal-status">{"Redirecting to checkout\u2026"}</p>}
        {error && <p className="paywall-modal-error">{error}</p>}
        <button type="button" className="secondary-btn" onClick={onClose} disabled={busy} style={{ justifySelf: "center" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}