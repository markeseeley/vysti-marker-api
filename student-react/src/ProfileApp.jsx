import { useCallback, useEffect, useState } from "react";
import { useAuthSession } from "./hooks/useAuthSession";
import UserMenu from "./components/UserMenu";
import ProfilePage from "./components/ProfilePage";
import Footer from "./components/Footer";
import "./ProfileApp.css";

export default function ProfileApp() {
  const { supa, isChecking: authChecking } = useAuthSession("profile");
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!authChecking && supa) {
      setAuthReady(true);
      (async () => {
        try {
          const { data } = await supa.auth.getSession();
          if (data?.session?.user) {
            setUser(data.session.user);
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
          <a href="/teacher_react.html" title="Upload and grade student essays">Mark</a>
          <a href="/student_react.html" title="Upload your essay for feedback">Revise</a>
          <a className="disabled" title="Coming soon..." aria-disabled="true">Write</a>
          <a href="/student_progress.html" title="Track your writing progress">Progress</a>
        </nav>
        <div className="actions">
          <UserMenu onSignOut={handleSignOut} />
        </div>
      </header>

      <ProfilePage
        user={user}
        onSignOut={handleSignOut}
        onPasswordUpdate={handlePasswordUpdate}
      />

      <Footer />
    </div>
  );
}
