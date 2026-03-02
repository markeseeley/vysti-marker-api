import { useCallback, useEffect, useState } from "react";
import { useAuthSession } from "./hooks/useAuthSession";
import { getApiBaseUrl } from "@shared/runtimeConfig";
import UserMenu from "./components/UserMenu";
import ProfilePage from "./components/ProfilePage";
import Footer from "./components/Footer";
import "./ProfileApp.css";

export default function ProfileApp() {
  const { supa, isChecking: authChecking, products } = useAuthSession("profile");
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(null);
  // Read checkout param synchronously during render (survives re-renders)
  const [checkoutBanner, setCheckoutBanner] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (checkout === "success" || checkout === "cancelled") {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      // Keep other params like ?upgrade=mark
      window.history.replaceState({}, "", url.pathname + url.search);
      return checkout;
    }
    return null;
  });

  // Auto-dismiss checkout banner after 8 seconds
  useEffect(() => {
    if (!checkoutBanner) return;
    const t = setTimeout(() => setCheckoutBanner(null), 8000);
    return () => clearTimeout(t);
  }, [checkoutBanner]);

  useEffect(() => {
    if (!authChecking && supa) {
      setAuthReady(true);
      (async () => {
        try {
          const { data } = await supa.auth.getSession();
          const sessionUser = data?.session?.user;
          if (sessionUser) {
            setUser(sessionUser);
            const accessToken = data.session.access_token;
            setToken(accessToken);
            // Fetch profile data (subscription tier, marks used, etc.)
            const apiBase = getApiBaseUrl();
            const resp = await fetch(`${apiBase}/api/profile`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (resp.ok) {
              setProfile(await resp.json());
            }
          }
        } catch {}
      })();
    }
  }, [authChecking, supa]);

  const handleSignOut = useCallback(async () => {
    if (!supa) {
      window.location.replace("/signin.html");
      return;
    }
    try {
      await supa.auth.signOut();
    } finally {
      localStorage.removeItem("vysti_role");
      localStorage.removeItem("vysti_products");
      window.location.replace("/signin.html");
    }
  }, [supa]);

  const handlePasswordUpdate = useCallback(async (newPassword) => {
    if (!supa) throw new Error("Not connected");
    const { error } = await supa.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }, [supa]);

  const handleManageBilling = useCallback(async () => {
    if (!token) return;
    const apiBase = getApiBaseUrl();
    const resp = await fetch(`${apiBase}/api/stripe/portal`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || "Could not open billing portal");
    }
    const { portal_url } = await resp.json();
    window.location.href = portal_url;
  }, [token]);

  const handleUpgrade = useCallback(async () => {
    if (!token) return;
    const apiBase = getApiBaseUrl();
    const resp = await fetch(`${apiBase}/api/stripe/checkout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ return_path: "/profile_react.html" }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || "Could not start checkout");
    }
    const { checkout_url } = await resp.json();
    window.location.href = checkout_url;
  }, [token]);

  const handleDeleteAccount = useCallback(async () => {
    if (!token) return;
    const apiBase = getApiBaseUrl();
    const resp = await fetch(`${apiBase}/api/delete-account`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || "Account deletion failed");
    }
    // Clear local state and redirect
    localStorage.removeItem("vysti_role");
    localStorage.removeItem("vysti_products");
    window.location.replace("/signin.html");
  }, [token]);

  if (!authReady) {
    return null;
  }

  return (
    <div className="student-react-shell">
      <header className="topbar">
        <div className="brand">
          <img src="/assets/logo.svg" alt="Vysti" />
        </div>
        <nav>
          {products?.has_mark
            ? <a href="/teacher_react.html" title="Upload and grade student essays">Mark</a>
            : <a className="disabled upgrade" title="Upgrade to unlock Mark" onClick={() => window.location.assign("/profile_react.html?upgrade=mark")}>Mark</a>}
          {products?.has_revise
            ? <a href="/student_react.html" title="Upload your essay for feedback">Revise</a>
            : <a className="disabled upgrade" title="Upgrade to unlock Revise" onClick={() => window.location.assign("/profile_react.html?upgrade=revise")}>Revise</a>}
          <a className="disabled" title="Coming soon..." aria-disabled="true">Write</a>
          <a href="/student_progress.html" title="Track your writing progress">Progress</a>
        </nav>
        <div className="actions">
          <UserMenu onSignOut={handleSignOut} />
        </div>
      </header>

      {checkoutBanner && (
        <div className={`checkout-banner checkout-banner--${checkoutBanner}`} role="status">
          <span>
            {checkoutBanner === "success"
              ? "Payment successful! You now have full access."
              : "Checkout was cancelled. You can try again any time."}
          </span>
          <button
            type="button"
            className="checkout-banner-close"
            aria-label="Dismiss"
            onClick={() => setCheckoutBanner(null)}
          >&times;</button>
        </div>
      )}

      <ProfilePage
        user={user}
        profile={profile}
        onSignOut={handleSignOut}
        onPasswordUpdate={handlePasswordUpdate}
        onManageBilling={handleManageBilling}
        onUpgrade={handleUpgrade}
        onDeleteAccount={handleDeleteAccount}
      />

      <Footer />
    </div>
  );
}
