import { useState } from "react";
import { getApiBaseUrl } from "@shared/runtimeConfig";
import { getSupaClient } from "../lib/supa";

const PLANS = [
  { key: "revise", label: "Revise", audience: "For students", price: "$8.99/mo", desc: "Upload essays, get feedback, and improve" },
  { key: "mark",   label: "Mark",   audience: "For teachers", price: "$11.99/mo", desc: "Grade student essays with detailed feedback" },
  { key: "both",   label: "Both",   audience: "Mark + Revise", price: "$14.99/mo", desc: "Full access to all features", featured: true },
];

export default function PaywallModal({ isOpen, onClose, returnPath, onRedeemSuccess }) {
  const [stripeBusy, setStripeBusy] = useState(false);
  const [couponBusy, setCouponBusy] = useState(false);
  const [error, setError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState("");

  if (!isOpen) return null;

  const anyBusy = stripeBusy || couponBusy;

  const handleSelect = async (product) => {
    if (anyBusy) return;
    setStripeBusy(true);
    setError("");
    setCouponMessage("");
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
        body: JSON.stringify({ product, return_path: returnPath || "/profile" }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || "Could not start checkout.");
      }
      const { checkout_url } = await resp.json();
      window.location.href = checkout_url;
    } catch (err) {
      setError(err?.message || "Something went wrong.");
      setStripeBusy(false);
    }
  };

  const handleRedeemCoupon = async (e) => {
    e.preventDefault();
    if (anyBusy) return;
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setError("Please enter a coupon code.");
      return;
    }
    setCouponBusy(true);
    setError("");
    setCouponMessage("");
    try {
      const supa = getSupaClient();
      const { data } = await supa.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error("Please sign in again.");
      const apiBase = getApiBaseUrl();
      const resp = await fetch(`${apiBase}/api/redeem-coupon`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        // Backend returns specific codes: 404 invalid, 410 expired,
        // 409 cap reached / already redeemed. `detail` carries the
        // human-readable message in each case.
        throw new Error(body.detail || "Coupon could not be redeemed.");
      }
      const desc = body.description ? ` — ${body.description}` : "";
      setCouponMessage(`Coupon applied${desc}. Please try your action again.`);

      // Refresh parent's entitlement/products before closing so the
      // next attempted action sees the new tier (no stale 'free').
      try {
        if (typeof onRedeemSuccess === "function") {
          await onRedeemSuccess();
        }
      } catch (refreshErr) {
        console.warn("Post-redemption refresh failed:", refreshErr);
      }

      // Brief delay so the user can read the success message.
      setTimeout(() => {
        setCouponBusy(false);
        setCouponCode("");
        setCouponMessage("");
        if (typeof onClose === "function") onClose();
      }, 1400);
    } catch (err) {
      setError(err?.message || "Coupon redemption failed.");
      setCouponBusy(false);
    }
  };

  const handleBackdropClick = () => {
    if (anyBusy) return;
    if (typeof onClose === "function") onClose();
  };

  return (
    <div className="modal-backdrop paywall-modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-card paywall-modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Choose a plan to continue</h3>
        <p className="paywall-modal-body">
          {"You’ve reached the free tier limit. Subscribe to unlock unlimited access."}
        </p>
        <div className="upgrade-cards">
          {PLANS.map((plan) => (
            <button
              key={plan.key}
              className={`upgrade-card${plan.featured ? " upgrade-card--featured" : ""}`}
              onClick={() => handleSelect(plan.key)}
              disabled={anyBusy}
            >
              <strong>{plan.label}</strong>
              <span className="upgrade-card-audience">{plan.audience}</span>
              <span className="upgrade-card-price">{plan.price}</span>
              <span className="upgrade-card-desc">{plan.desc}</span>
            </button>
          ))}
        </div>
        {stripeBusy && <p className="paywall-modal-status">{"Redirecting to checkout…"}</p>}

        <div className="paywall-coupon-section">
          <div className="paywall-coupon-divider"><span>or</span></div>
          <form className="paywall-coupon-form" onSubmit={handleRedeemCoupon} autoComplete="off">
            <label htmlFor="paywall-coupon-input" className="paywall-coupon-label">
              Have a coupon code?
            </label>
            <div className="paywall-coupon-input-row">
              <input
                id="paywall-coupon-input"
                type="text"
                placeholder="e.g. REVISESPRING2026"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                disabled={anyBusy}
                autoComplete="off"
                spellCheck={false}
                style={{ textTransform: "uppercase" }}
              />
              <button
                type="submit"
                className="secondary-btn paywall-coupon-apply"
                disabled={anyBusy || !couponCode.trim()}
              >
                {couponBusy ? "Redeeming…" : "Apply"}
              </button>
            </div>
          </form>
        </div>

        {couponMessage && <p className="paywall-modal-status">{couponMessage}</p>}
        {error && <p className="paywall-modal-error">{error}</p>}

        <button
          type="button"
          className="secondary-btn"
          onClick={onClose}
          disabled={anyBusy}
          style={{ justifySelf: "center" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
