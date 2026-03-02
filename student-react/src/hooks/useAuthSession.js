import { useEffect, useRef, useState } from "react";
import { redirectToSignin } from "../lib/auth";
import { logEvent, logError } from "../lib/logger";
import { getSupaClient } from "../lib/supa";
import { getApiBaseUrl } from "@shared/runtimeConfig";

export function useAuthSession(role = "student") {
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

  useEffect(() => {
    guardActive.current = true;
    const client = getSupaClient();
    setSupa(client);

    if (!client) {
      setAuthError("Supabase client not available.");
      setIsChecking(false);
      logError("Supabase client not available");
      return undefined;
    }

    const runGuard = async () => {
      try {
        logEvent("auth_check_start");
        const { data } = await client.auth.getSession();
        if (!data?.session) {
          logEvent("auth_session_missing");
          redirectToSignin();
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

        // Fetch entitlement + product data from profile API
        try {
          const apiBase = getApiBaseUrl();
          const profileResp = await fetch(`${apiBase}/api/profile`, {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          });
          if (profileResp.ok && guardActive.current) {
            const profileData = await profileResp.json();
            setEntitlement({
              subscription_tier: profileData.subscription_tier || "free",
              marks_used: profileData.marks_used || 0,
              marks_limit: 1,
            });
            // Update products from API (source of truth) and sync localStorage
            const apiProducts = {
              has_mark: !!profileData.has_mark,
              has_revise: !!profileData.has_revise,
              has_write: !!profileData.has_write,
            };
            setProducts(apiProducts);
            try { localStorage.setItem("vysti_products", JSON.stringify(apiProducts)); } catch {}
          }
        } catch (e) {
          // Non-critical: entitlement defaults to free tier
          console.warn("Failed to fetch entitlement:", e);
        }

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
        logError("Auth check failed", { error: err?.message });
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
  }, []);

  return {
    supa,
    isChecking,
    authError,
    products,
    entitlement,
    setEntitlement,
    redirectToSignin
  };
}
