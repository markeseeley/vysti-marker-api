import { useCallback, useEffect, useRef, useState } from "react";
import { redirectToSignin } from "../lib/auth";
import { logEvent, logCriticalError } from "../lib/logger";
import { getSupaClient } from "../lib/supa";
import { getApiBaseUrl } from "@shared/runtimeConfig";

export function useAuthSession(role = "student", { skipRedirect = false } = {}) {
  const [supa, setSupa] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  const [products, setProducts] = useState({ has_mark: false, has_revise: false, has_write: false });
  const [entitlement, setEntitlement] = useState({
    subscription_tier: "free",
    marks_used: 0,
    marks_limit: 1,
  });
  const guardActive = useRef(true);

  // Fetch and apply profile/entitlement state for a given session.
  // Extracted so refreshProfile() (e.g. after coupon redemption) can
  // reuse the exact same shape without duplicating the parse logic.
  const applyProfile = useCallback(async (session) => {
    if (!session?.access_token) return false;
    try {
      const apiBase = getApiBaseUrl();
      const profileResp = await fetch(`${apiBase}/api/profile`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!profileResp.ok) return false;
      const profileData = await profileResp.json();
      if (!guardActive.current) return false;
      setEntitlement({
        subscription_tier: profileData.subscription_tier || "free",
        marks_used: profileData.marks_used || 0,
        marks_limit: 1,
      });
      const apiProducts = {
        has_mark: !!profileData.has_mark,
        has_revise: !!profileData.has_revise,
        has_write: !!profileData.has_write,
      };
      setProducts(apiProducts);
      try { localStorage.setItem("vysti_products", JSON.stringify(apiProducts)); } catch {}
      return true;
    } catch (e) {
      console.warn("Failed to fetch entitlement:", e);
      return false;
    }
  }, []);

  // Re-fetch profile on demand (e.g. after coupon redemption flips
  // subscription_tier from 'free' to 'paid' so the paywall can close
  // and the user's next mark/upload attempt sees fresh entitlement).
  const refreshProfile = useCallback(async () => {
    const client = supa || getSupaClient();
    if (!client) return false;
    const { data } = await client.auth.getSession();
    if (!data?.session) return false;
    return applyProfile(data.session);
  }, [supa, applyProfile]);

  useEffect(() => {
    guardActive.current = true;
    const client = getSupaClient();
    setSupa(client);

    if (!client) {
      setAuthError("Supabase client not available.");
      setIsChecking(false);
      logCriticalError("Supabase client not available", { errorType: "auth_init" });
      return undefined;
    }

    const runGuard = async () => {
      try {
        // Skip auth on localhost for local development
        if (window.location.hostname === "localhost") {
          if (guardActive.current) setIsChecking(false);
          return;
        }
        logEvent("auth_check_start");
        const { data } = await client.auth.getSession();
        if (!data?.session) {
          logEvent("auth_session_missing");
          if (!skipRedirect) {
            redirectToSignin();
            return;
          }
          // skipRedirect: let the app load without auth (e.g. mobile camera)
          if (guardActive.current) setIsChecking(false);
          return;
        }
        try { localStorage.setItem("vysti_role", role); } catch {}
        try {
          const raw = localStorage.getItem("vysti_products");
          if (raw) {
            const p = JSON.parse(raw);
            if (guardActive.current) setProducts(p);
          }
        } catch {}

        await applyProfile(data.session);

        if (guardActive.current) {
          setIsChecking(false);
        }
        logEvent("auth_session_valid");
      } catch (err) {
        console.error("Failed to read session", err);
        if (guardActive.current) {
          setAuthError("Unable to verify session. Please refresh.");
          setIsChecking(false);
        }
        logCriticalError("Auth check failed", { errorType: "auth_failure", error: err?.message });
      }
    };

    runGuard();

    const { data: subscription } = client.auth.onAuthStateChange(() => {
      runGuard();
    });

    return () => {
      guardActive.current = false;
      subscription?.subscription?.unsubscribe();
    };
  }, [applyProfile, role, skipRedirect]);

  return {
    supa,
    isChecking,
    authError,
    products,
    entitlement,
    setEntitlement,
    refreshProfile,
    redirectToSignin
  };
}
