import { studentExtraFields } from "./studentProfileFields";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { signup } from "../api";
import { Brand } from "./DashboardNavigation";

export function ProfileField({ field, value, onChange, prefix = "signup" }) {
  const { name, label, multiline, ...attributes } = field;
  const input = { id: `${prefix}-${name}`, name, className: "input", value: value ?? "", onChange, ...attributes };
  return <div className={multiline ? "signup-wide" : ""}><label htmlFor={input.id}>{label}{attributes.required ? " *" : " (optional)"}</label>
    {multiline ? <textarea {...input} rows={3} /> : <input {...input} type={attributes.type || "text"} />}</div>;
}

export default function SignupRoute() {
  const { role } = useParams();
  return <SignupPortal key={role} role={role} />;
}

function SignupPortal({ role }) {
  const [form, setForm] = useState({ backlogs: 0 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const student = role === "student";
  const title = student ? "Student" : role === "recruiter" ? "Recruiter" : "TPO";
  if (!["student", "recruiter", "tpo"].includes(role)) return <main className="status-page"><h1>Choose your signup portal</h1><Link to="/">Back to workspaces</Link></main>;
  function change(event) { setForm(current => ({ ...current, [event.target.name]: event.target.value })); }
  async function submit(event) {
    event.preventDefault(); setError("");
    if (form.password !== form.confirm_password) { setError("Passwords do not match."); return; }
    setBusy(true);
    const shared = { role, name: form.name, email: form.email, password: form.password, phone: form.phone };
    const payload = student ? { ...shared, branch: form.branch, cgpa: Number(form.cgpa), backlogs: Number(form.backlogs),
      skills: (form.skills || "").split(",").map(value => value.trim()).filter(Boolean),
      ...Object.fromEntries(studentExtraFields.map(({name}) => [name, name === "graduation_year" ? Number(form[name]) : form[name] || ""]))
    } : { ...shared, organization: form.organization, designation: form.designation, department: form.department || "",
      website: form.website || "", invitation_code: form.invitation_code };
    try { await signup(payload); setCreated(true); setForm({}); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const common = [
    {name: "name", label: "Full name", required: true, maxLength: 100, autoComplete: "name"},
    {name: "email", label: student ? "Email address" : "Work email", type: "email", required: true, maxLength: 254, autoComplete: "email"},
    {name: "phone", label: "Phone number", type: "tel", required: true, maxLength: 20, autoComplete: "tel"},
  ];
  const academics = [
    {name: "branch", label: "Branch / program", required: true, maxLength: 50, placeholder: "CSE, IT, ECE..."},
    {name: "cgpa", label: "CGPA (out of 10)", type: "number", min: 0, max: 10, step: "0.01", required: true},
    {name: "backlogs", label: "Current backlogs", type: "number", min: 0, max: 100, required: true},
    {name: "skills", label: "Tech stack & skills", multiline: true, placeholder: "Python, React, SQL (comma-separated, up to 50 skills)"},
  ];
  const staff = [
    {name: "organization", label: role === "recruiter" ? "Company name" : "College / university", required: true, maxLength: 200},
    {name: "designation", label: "Designation / job title", required: true, maxLength: 100},
    {name: "department", label: "Department", maxLength: 100},
    {name: "website", label: "Organization website", type: "url", maxLength: 500},
    {name: "invitation_code", label: `${title} invitation code`, required: true, type: "password", maxLength: 200, autoComplete: "off"},
  ];
  return <div className="login-page"><header className="landing-header"><Brand /><Link className="btn btn-ghost" to={`/${role}`}>Back to sign in</Link></header>
    <main className="signup-layout"><span className="eyebrow">JOIN YOUR CAMPUS COMMUNITY</span><h1>{title} signup</h1>
      {created ? <section className="section-panel" role="status"><h2>Your account is ready</h2><p className="my-4">Your details have been saved. Sign in to open your workspace.</p><Link className="btn btn-primary" to={`/${role}`}>Sign in</Link></section> : <>
        <p className="text-slate-400 mb-6">{student ? "Build your profile so recruiters can discover your skills and achievements." : "Register your professional details using the invitation code supplied by your campus administrator."} Fields marked * are required.</p>
        <nav className="signup-roles" aria-label="Signup role">{["student", "recruiter", "tpo"].map(item => <Link key={item} to={`/signup/${item}`} className="btn btn-ghost" aria-current={role === item ? "page" : undefined}>{item === "tpo" ? "TPO" : item[0].toUpperCase() + item.slice(1)}</Link>)}</nav>
        <form className="section-panel" onSubmit={submit}><fieldset disabled={busy} className="signup-grid">
          {[...common, ...(student ? [...academics, ...studentExtraFields] : staff),
            {name: "password", label: "Password (12-128 characters)", type: "password", required: true, minLength: 12, maxLength: 128, autoComplete: "new-password"},
            {name: "confirm_password", label: "Confirm password", type: "password", required: true, minLength: 12, maxLength: 128, autoComplete: "new-password"},
          ].map(field => <ProfileField key={field.name} field={field} value={form[field.name]} onChange={change} />)}
          {error && <p className="signup-wide text-rose-400" role="alert">{error}</p>}
          <div className="signup-wide"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Creating account..." : "Create account"}</button><p className="mt-4">Already registered? <Link to={`/${role}`}>Sign in</Link></p></div>
        </fieldset></form>
      </>}
    </main></div>;
}
