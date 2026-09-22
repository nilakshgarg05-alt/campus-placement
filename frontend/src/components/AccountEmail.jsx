import { useState } from "react";
import { correctAccountEmail } from "../api";
export default function AccountEmail({ email }) {
  const [nextEmail, setNextEmail] = useState(email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { await correctAccountEmail(nextEmail, password); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <details className="section-panel mt-6"><summary>Correct account email</summary>
    <p className="text-slate-400 my-4">Confirm your current password to change your login email. You will sign in again with the new address.</p>
    <form onSubmit={save} className="space-y-4">
      <div><label htmlFor="correct-email">New email</label><input id="correct-email" type="email" className="input" value={nextEmail} onChange={event => setNextEmail(event.target.value)} maxLength={254} required /></div>
      <div><label htmlFor="confirm-email-password">Current password</label><input id="confirm-email-password" type="password" autoComplete="current-password" className="input" value={password} onChange={event => setPassword(event.target.value)} maxLength={128} required /></div>
      {error && <p role="alert" className="text-rose-400">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy || nextEmail === email}>{busy ? "Updating..." : "Update email"}</button>
    </form></details>;
}
