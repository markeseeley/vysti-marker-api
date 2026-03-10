import { useRef, useState } from "react";

function getProvider(user) {
  if (!user) return "Unknown";
  const identity = user.identities?.[0];
  if (identity?.provider === "google") return "Google";
  return "Email";
}

function getDisplayName(user) {
  if (!user) return "";
  const meta = user.user_metadata || {};
  return meta.full_name || meta.name || "";
}

function getAvatarUrl(user, profile) {
  if (profile?.avatar_url) return profile.avatar_url;
  if (!user) return null;
  const meta = user.user_metadata || {};
  return meta.avatar_url || meta.picture || null;
}

function formatDate(dateStr) {
  if (!dateStr) return "\u2014";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "\u2014";
  }
}

function getProductName(profile) {
  if (!profile) return null;
  const hasMark = !!profile.has_mark;
  const hasRevise = !!profile.has_revise;
  if (hasMark && hasRevise) return "Mark & Revise";
  if (hasMark) return "Mark";
  if (hasRevise) return "Revise";
  return null;
}

function formatStatus(status) {
  if (!status) return null;
  const map = {
    active: "Active",
    past_due: "Past due",
    cancelled: "Cancelled",
    trial: "Trial",
    none: null,
  };
  return map[status] ?? status;
}

export default function ProfilePage({
  user, profile,
  onSignOut, onPasswordUpdate,
  onManageBilling, onUpgrade, onDeleteAccount,
  onAvatarUpload,
  upgradeHint,
}) {
  const [pwSection, setPwSection] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwStatus, setPwStatus] = useState({ type: "", msg: "" });
  const [pwBusy, setPwBusy] = useState(false);

  const [deleteStep, setDeleteStep] = useState(0); // 0=hidden, 1=reason, 2=confirm
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteDetails, setDeleteDetails] = useState("");
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deleteStatus, setDeleteStatus] = useState({ type: "", msg: "" });
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState("");

  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef(null);

  const provider = getProvider(user);
  const displayName = getDisplayName(user);
  const avatarUrl = getAvatarUrl(user, profile);
  const isEmailUser = provider === "Email";

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onAvatarUpload) return;
    setAvatarBusy(true);
    try {
      await onAvatarUpload(file);
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setAvatarBusy(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const tier = profile?.subscription_tier || "free";
  const isPaid = tier === "paid";
  const productName = getProductName(profile);
  const status = formatStatus(profile?.subscription_status);
  const marksUsed = profile?.marks_used ?? 0;

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPw.length < 6) {
      setPwStatus({ type: "error", msg: "Password must be at least 6 characters." });
      return;
    }
    if (newPw !== confirmPw) {
      setPwStatus({ type: "error", msg: "Passwords do not match." });
      return;
    }
    setPwBusy(true);
    setPwStatus({ type: "", msg: "" });
    try {
      await onPasswordUpdate(newPw);
      setPwStatus({ type: "success", msg: "Password updated successfully." });
      setNewPw("");
      setConfirmPw("");
      setPwSection(false);
    } catch (err) {
      setPwStatus({ type: "error", msg: err?.message || "Failed to update password." });
    } finally {
      setPwBusy(false);
    }
  };

  const handleBillingClick = async () => {
    setBillingBusy(true);
    setBillingError("");
    try {
      await onManageBilling();
    } catch (err) {
      setBillingError(err?.message || "Could not open billing portal.");
      setBillingBusy(false);
    }
  };

  const handleUpgradeClick = async (product) => {
    setBillingBusy(true);
    setBillingError("");
    try {
      await onUpgrade(product);
    } catch (err) {
      setBillingError(err?.message || "Could not start checkout.");
      setBillingBusy(false);
    }
  };

  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    if (deleteConfirmEmail.trim().toLowerCase() !== (user?.email || "").toLowerCase()) {
      setDeleteStatus({ type: "error", msg: "Email does not match." });
      return;
    }
    setDeleteBusy(true);
    setDeleteStatus({ type: "", msg: "" });
    try {
      await onDeleteAccount({ reason: deleteReason, details: deleteDetails });
    } catch (err) {
      setDeleteStatus({ type: "error", msg: err?.message || "Account deletion failed." });
      setDeleteBusy(false);
    }
  };

  const resetDeleteFlow = () => {
    setDeleteStep(0);
    setDeleteReason("");
    setDeleteDetails("");
    setDeleteConfirmEmail("");
    setDeleteStatus({ type: "", msg: "" });
  };

  return (
    <main className="page profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div
            className={`profile-avatar-wrap${avatarBusy ? " profile-avatar-uploading" : ""}`}
            onClick={() => avatarInputRef.current?.click()}
            role="button"
            tabIndex={0}
            title="Change profile photo"
            onKeyDown={(e) => { if (e.key === "Enter") avatarInputRef.current?.click(); }}
          >
            {avatarUrl ? (
              <img className="profile-avatar" src={avatarUrl} alt="" />
            ) : (
              <div className="profile-avatar profile-avatar-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
            <div className="profile-avatar-overlay">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              hidden
              onChange={handleAvatarChange}
            />
          </div>
          <div className="profile-header-info">
            <h1>{displayName || user?.email || "Your Profile"}</h1>
            {displayName && <p className="profile-email">{user?.email}</p>}
          </div>
        </div>

        <section className="profile-card">
          <h2>Account Details</h2>
          <div className="profile-field">
            <span className="profile-label">Email</span>
            <span className="profile-value">{user?.email || "\u2014"}</span>
          </div>
          <div className="profile-field">
            <span className="profile-label">Sign-in method</span>
            <span className="profile-value">
              {provider === "Google" && (
                <svg className="provider-icon" width="16" height="16" viewBox="0 0 48 48">
                  <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.25 17.74 9.5 24 9.5z"/>
                  <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.74-13.47-9.13l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
              )}
              {provider}
            </span>
          </div>
          <div className="profile-field">
            <span className="profile-label">Member since</span>
            <span className="profile-value">{formatDate(user?.created_at)}</span>
          </div>
          <div className="profile-field">
            <span className="profile-label">Last sign-in</span>
            <span className="profile-value">{formatDate(user?.last_sign_in_at)}</span>
          </div>
        </section>

        {profile && (
          <section className="profile-card">
            <h2>Subscription</h2>
            <div className="profile-field">
              <span className="profile-label">Plan</span>
              <span className="profile-value">
                <span className={`subscription-badge ${isPaid ? "subscription-badge-paid" : "subscription-badge-free"}`}>
                  {isPaid ? (productName || "Paid") : "Free"}
                </span>
              </span>
            </div>
            {isPaid && status && (
              <div className="profile-field">
                <span className="profile-label">Status</span>
                <span className="profile-value">{status}</span>
              </div>
            )}
            <div className="profile-field">
              <span className="profile-label">Essays marked</span>
              <span className="profile-value">{marksUsed}</span>
            </div>
            {billingError && (
              <p className="pw-status pw-status-error">{billingError}</p>
            )}
            {isPaid ? (
              <div style={{ marginTop: 16 }}>
                <button
                  className="profile-btn"
                  onClick={handleBillingClick}
                  disabled={billingBusy}
                >
                  {billingBusy ? "Opening\u2026" : "Manage Billing"}
                </button>
              </div>
            ) : (
              <div className="upgrade-options">
                <h3>Choose a plan</h3>
                <div className="upgrade-cards">
                  <button
                    className={`upgrade-card${upgradeHint === "revise" ? " upgrade-card--highlighted" : ""}`}
                    onClick={() => handleUpgradeClick("revise")}
                    disabled={billingBusy}
                  >
                    <strong>Revise</strong>
                    <span className="upgrade-card-audience">For students</span>
                    <span className="upgrade-card-price">$8.99/mo</span>
                    <span className="upgrade-card-desc">Upload essays, get feedback, and improve</span>
                  </button>
                  <button
                    className={`upgrade-card${upgradeHint === "mark" ? " upgrade-card--highlighted" : ""}`}
                    onClick={() => handleUpgradeClick("mark")}
                    disabled={billingBusy}
                  >
                    <strong>Mark</strong>
                    <span className="upgrade-card-audience">For teachers</span>
                    <span className="upgrade-card-price">$11.99/mo</span>
                    <span className="upgrade-card-desc">Grade student essays with detailed feedback</span>
                  </button>
                  <button
                    className={`upgrade-card upgrade-card--featured${upgradeHint === "both" || !upgradeHint ? " upgrade-card--highlighted" : ""}`}
                    onClick={() => handleUpgradeClick("both")}
                    disabled={billingBusy}
                  >
                    <strong>Both</strong>
                    <span className="upgrade-card-audience">Mark + Revise</span>
                    <span className="upgrade-card-price">$14.99/mo</span>
                    <span className="upgrade-card-desc">Full access to all features</span>
                  </button>
                </div>
                {billingBusy && <p className="upgrade-loading">{"Redirecting to checkout\u2026"}</p>}
              </div>
            )}
          </section>
        )}

        {isEmailUser && (
          <section className="profile-card">
            <h2>Security</h2>
            {!pwSection ? (
              <button className="profile-btn" onClick={() => setPwSection(true)}>
                Change password
              </button>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="pw-form">
                <div className="pw-field">
                  <label htmlFor="new-pw">New password</label>
                  <input
                    id="new-pw"
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <div className="pw-field">
                  <label htmlFor="confirm-pw">Confirm password</label>
                  <input
                    id="confirm-pw"
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                {pwStatus.msg && (
                  <p className={`pw-status pw-status-${pwStatus.type}`}>{pwStatus.msg}</p>
                )}
                <div className="pw-actions">
                  <button type="submit" className="profile-btn profile-btn-primary" disabled={pwBusy}>
                    {pwBusy ? "Updating..." : "Update password"}
                  </button>
                  <button type="button" className="profile-btn" onClick={() => { setPwSection(false); setPwStatus({ type: "", msg: "" }); }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        <section className="profile-card">
          <h2>Session</h2>
          <button className="profile-btn profile-btn-danger" onClick={onSignOut}>
            Sign out
          </button>
        </section>

        <section className="profile-card profile-danger">
          <h2>Delete Account</h2>
          {deleteStep === 0 && (
            <button
              className="profile-btn profile-btn-danger"
              onClick={() => setDeleteStep(1)}
            >
              Delete account
            </button>
          )}
          {deleteStep === 1 && (
            <div className="delete-confirm">
              <p className="delete-warning">
                Are you sure you want to delete your account? We&rsquo;d love to know
                why so we can improve.
              </p>
              <div className="delete-reasons">
                {[
                  "I don't need it anymore",
                  "Too expensive",
                  "Missing features I need",
                  "Switching to another tool",
                  "Other",
                ].map((r) => (
                  <label key={r} className="delete-reason-option">
                    <input
                      type="radio"
                      name="delete-reason"
                      value={r}
                      checked={deleteReason === r}
                      onChange={() => setDeleteReason(r)}
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
              {deleteReason && (
                <div className="pw-field">
                  <label htmlFor="delete-details">Anything else you&rsquo;d like to share? (optional)</label>
                  <input
                    id="delete-details"
                    type="text"
                    value={deleteDetails}
                    onChange={(e) => setDeleteDetails(e.target.value)}
                    placeholder="Tell us more..."
                    autoComplete="off"
                  />
                </div>
              )}
              <div className="pw-actions">
                <button
                  type="button"
                  className="profile-btn profile-btn-danger"
                  disabled={!deleteReason}
                  onClick={() => setDeleteStep(2)}
                >
                  Continue
                </button>
                <button type="button" className="profile-btn" onClick={resetDeleteFlow}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {deleteStep === 2 && (
            <form onSubmit={handleDeleteSubmit} className="delete-confirm">
              <p className="delete-warning">
                This will permanently delete your account, all essays, and cancel
                your subscription. This cannot be undone.
              </p>
              <div className="pw-field">
                <label htmlFor="delete-email">Type your email to confirm</label>
                <input
                  id="delete-email"
                  type="email"
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                  placeholder={user?.email || ""}
                  autoComplete="off"
                />
              </div>
              {deleteStatus.msg && (
                <p className={`pw-status pw-status-${deleteStatus.type}`}>{deleteStatus.msg}</p>
              )}
              <div className="pw-actions">
                <button
                  type="submit"
                  className="profile-btn profile-btn-danger-fill"
                  disabled={deleteBusy}
                >
                  {deleteBusy ? "Deleting\u2026" : "Permanently delete"}
                </button>
                <button type="button" className="profile-btn" onClick={resetDeleteFlow}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
