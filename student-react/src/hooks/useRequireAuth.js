import { useEffect, useState } from "react";
import { redirectToSignin } from "../lib/auth";
import { logError, logEvent } from "../lib/logger";
import { getSupaClient } from "../lib/supa";

export function useRequireAuth() {
  const [supa, setSupa] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const client = getSupaClient();
    setSupa(client);

    if (!client) {
      setAuthError("Supabase client not available.");
      setIsChecking(false);
      logError("Supabase client not available");
      return undefined;
    }

    let isActive = true;

    const runGuard = async () => {
      try {
        logEvent("auth_check_start");
        const { data } = await client.auth.getSession();
        if (!data?.session) {
          logEvent("auth_session_missing");
          redirectToSignin();
          return;
        }
        localStorage.setItem("vysti_role", "student");
        if (isActive) {
          setIsChecking(false);
        }
        logEvent("auth_session_valid");
      } catch (err) {
        console.error("Failed to read session", err);
        if (isActive) {
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
      isActive = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  return { supa, isChecking, authError };
}
