import { useEffect, useRef, useState } from "react";
import { redirectToSignin } from "../lib/auth";
import { logEvent, logError } from "../lib/logger";
import { getSupaClient } from "../lib/supa";

export function useAuthSession() {
  const [supa, setSupa] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [authError, setAuthError] = useState("");
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
        localStorage.setItem("vysti_role", "student");
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
    redirectToSignin
  };
}
