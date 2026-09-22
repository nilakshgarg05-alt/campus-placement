import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getAccount, getSessionToken, login } from "../api";
import { Brand } from "./DashboardNavigation";

export default function AuthPortal({ role, children }) {
  const [account, setAccount] = useState(null);
  const [checking, setChecking] = useState(() => Boolean(getSessionToken()));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const ended = (event) => { setAccount(null); setError(event.detail || "Your session has ended. Please sign in again."); };
    window.addEventListener("session-ended", ended);
    if (getSessionToken()) {
      getAccount().then((data) => { if (active) setAccount(data); })
        .catch((err) => { if (active) setError(err.message); })
        .finally(() => { if (active) setChecking(false); });
    }
    return () => { active = false; window.removeEventListener("session-ended", ended); };
  }, []);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try { setAccount(await login(form.get("email"), form.get("password"))); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (checking) return <div className="loading-overlay"><div className="spinner" /><span>Checking your session…</span></div>;
  if (account && account.role !== role) return <Navigate to={`/${account.role}`} replace />;
  if (account) return children;
  const title = role === "tpo" ? "Placement team" : role === "recruiter" ? "Recruiter" : "Student";
  return <div className="login-page">
    <header className="landing-header"><Brand /><Link className="btn btn-ghost" to="/">Back to home</Link></header>
    <main className="login-layout">
      <section className="login-intro"><span className="eyebrow">YOUR CAREER. YOUR SPACE.</span><h1>Your next chapter<br />starts here.</h1><p>Sign in to your own workspace. Keep your profile current, build your skills, and connect with the right opportunities.</p></section>
      <section className="section-panel login-card"><span className="eyebrow">WELCOME BACK</span><h2>{title} sign in</h2><p className="text-slate-400">Sign in with your registered email and password.</p>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <div><label htmlFor="login-email">Email address</label><input id="login-email" name="email" type="email" autoComplete="username" className="input" maxLength={254} required /></div>
          <div><label htmlFor="login-password">Password</label><input id="login-password" name="password" type="password" autoComplete="current-password" className="input" maxLength={128} required /></div>
          {error && <p role="alert" className="text-rose-400">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="mt-6">New here? <Link className="btn btn-ghost" to={`/signup/${role}`}>Create an account</Link></p><p className="login-help">Forgot your password or already have a campus profile? Contact your placement team for help.</p>
      </section>
    </main>
  </div>;
}
