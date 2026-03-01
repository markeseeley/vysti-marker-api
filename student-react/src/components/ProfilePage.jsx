import { useState } from "react";

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

function getAvatarUrl(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return meta.avatar_url || meta.picture || null;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function getRoleName() {
  try {
    const role = localStorage.getItem("vysti_role");
    if (role === "teacher") return "Teacher";
    if (role === "student") return "Student";
    return "Not set";
  } catch {
    return "Not set";
  }
}

export default function ProfilePage({ user, onSignOut, onPasswordUpdate }) {
  const [pwSection, setPwSection] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwStatus, setPwStatus] = useState({ type: "", msg: "" });
  const [pwBusy, setPwBusy] = useState(false);

  const provider = getProvider(user);
  const displayName = getDisplayName(user);
  const avatarUrl = getAvatarUrl(user);
  const isEmailUser = provider === "Email";

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

  return (
    <main className="page profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar-wrap">
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
            <span className="profile-value">{user?.email || "—"}</span>
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
            <span className="profile-label">Role</span>
            <span className="profile-value">{getRoleName()}</span>
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
      </div>
    </main>
  );
}
