import { useEffect, useRef, useState } from "react";
import { getSupaClient } from "../lib/supa";

const buildRedirectTarget = () => {
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/signin.html?redirect=${encodeURIComponent(next)}`;
};

export function useAuthSession() {
  const [supa, setSupa] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  const guardActive = useRef(true);

  const redirectToSignIn = () => {
    window.location.replace(buildRedirectTarget());
  };

  useEffect(() => {
    guardActive.current = true;
    const client = getSupaClient();
    setSupa(client);

    if (!client) {
      setAuthError("Supabase client not available.");
      setIsChecking(false);
      return undefined;
    }

    const runGuard = async () => {
      try {
        const { data } = await client.auth.getSession();
        if (!data?.session) {
          redirectToSignIn();
          return;
        }
        localStorage.setItem("vysti_role", "student");
        if (guardActive.current) {
          setIsChecking(false);
        }
      } catch (err) {
        console.error("Failed to read session", err);
        if (guardActive.current) {
          setAuthError("Unable to verify session. Please refresh.");
          setIsChecking(false);
        }
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
    redirectToSignIn
  };
}
