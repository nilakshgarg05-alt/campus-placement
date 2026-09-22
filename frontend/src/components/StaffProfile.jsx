import { useEffect, useState } from "react";
import { getAccount, updateStaffProfile } from "../api";
import AccountEmail from "./AccountEmail";
import { ProfileField } from "./SignupPortal";
export default function StaffProfile() {
  const [account, setAccount] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    getAccount().then(data => { if (active) { setAccount(data); setForm(data.profile || {}); } })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);
  const fields = [
    {name: "name", label: "Full name", required: true, maxLength: 100},
    {name: "organization", readOnly: account?.role === "recruiter", label: account?.role === "recruiter" ? "Company" : "College / university", required: true, maxLength: 200},
    {name: "designation", label: "Designation", required: true, maxLength: 100},
    {name: "department", label: "Department", maxLength: 100},
    {name: "phone", label: "Phone", type: "tel", required: true, maxLength: 20},
    {name: "website", label: "Organization website", type: "url", maxLength: 500},
  ];
  async function save(event) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const result = await updateStaffProfile(Object.fromEntries(fields.map(({name}) => [name, form[name] || ""])));
      setAccount(result); setForm(result.profile); setSuccess("Your profile has been saved.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  if (!account) return <div className="section-panel">{error ? <p role="alert">{error}</p> : "Loading profile..."}</div>;
  return <section className="max-w-2xl"><form className="section-panel" onSubmit={save}>
    <h2 className="text-2xl font-bold mb-6">My professional profile</h2><p className="mb-4">Account email: {account.email}</p>
    {account.role === "recruiter" && <p className="mb-4">Your company is fixed at registration. You can update your contact and professional details.</p>}
    <fieldset disabled={saving} className="signup-grid">{fields.map(field => <ProfileField key={field.name} prefix="staff" field={field} value={form[field.name]} onChange={event => setForm(current => ({...current, [event.target.name]: event.target.value}))} />)}</fieldset>
    {error && <p className="text-rose-400 mt-4" role="alert">{error}</p>}
    {success && <p className="mt-4" role="status">{success}</p>}
    <button className="btn btn-primary mt-6" type="submit" disabled={saving}>{saving ? "Saving..." : "Save profile"}</button>
  </form><AccountEmail email={account.email} /></section>;
}
