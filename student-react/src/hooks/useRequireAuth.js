import { useEffect, useState } from "react";
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
      return undefined;
    }

    let isActive = true;

    const runGuard = async () => {
      try {
        const { data } = await client.auth.getSession();
        if (!data?.session) {
          window.location.replace("/signin.html");
          return;
        }
        localStorage.setItem("vysti_role", "student");
        if (isActive) {
          setIsChecking(false);
        }
      } catch (err) {
        console.error("Failed to read session", err);
        if (isActive) {
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
      isActive = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  return { supa, isChecking, authError };
}
