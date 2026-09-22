import AccountEmail from "./AccountEmail";
import { ProfileField } from "./SignupPortal";
import { studentExtraFields } from "./studentProfileFields";
import { useState } from "react";
import { updateMyProfile } from "../api";

export default function StudentProfile({ student, onSaved }) {
  const [form, setForm] = useState({ ...student, skills: (student.skills || []).join(", ") });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  function change(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
  async function save(event) {
    event.preventDefault(); setError(""); setSaving(true);
    try {
      const profile = await updateMyProfile({
        ...Object.fromEntries(studentExtraFields.map(({name}) => [name, name === "graduation_year" ? (form[name] ? Number(form[name]) : null) : form[name] || ""])),
        name: form.name, branch: form.branch,
        phone: form.phone || "", cgpa: Number(form.cgpa), backlogs: Number(form.backlogs),
        skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean) });
      onSaved(profile);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  return <section className="max-w-2xl animate-fade-in-up"><h2 className="text-2xl font-bold">My profile & tech stack</h2>
    <p className="text-slate-400 mt-2 mb-6">Your saved details are used for recruiter matching, job eligibility, and personalized preparation.</p>
    <form className="section-panel space-y-4" onSubmit={save}>
      <div><label htmlFor="profile-name">Full name</label><input id="profile-name" className="input" name="name" value={form.name} onChange={change} maxLength={100} required /></div>
      <div><label htmlFor="profile-email">Account email</label><input id="profile-email" className="input" value={student.email} type="email" readOnly /><p className="text-sm text-slate-400 mt-1">Use Correct account email below to update your login address.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label htmlFor="profile-branch">Branch</label><input id="profile-branch" className="input" name="branch" value={form.branch} onChange={change} maxLength={50} required /></div>
        <div><label htmlFor="profile-phone">Phone</label><input id="profile-phone" className="input" name="phone" type="tel" value={form.phone || ""} onChange={change} maxLength={20} /></div>
        <div><label htmlFor="profile-cgpa">CGPA (out of 10)</label><input id="profile-cgpa" className="input" name="cgpa" type="number" min="0" max="10" step="0.01" value={form.cgpa} onChange={change} required /></div>
        <div><label htmlFor="profile-backlogs">Backlogs</label><input id="profile-backlogs" className="input" name="backlogs" type="number" min="0" max="100" step="1" value={form.backlogs} onChange={change} required /></div>
      </div>
      <div><label htmlFor="profile-skills">Tech stack & skills</label><textarea id="profile-skills" className="input" name="skills" rows={4} value={form.skills} onChange={change} placeholder="Python, React, SQL, Java" aria-describedby="skills-help" /><p id="skills-help" className="text-sm text-slate-400 mt-1">Separate skills with commas. Include languages, frameworks, and tools (up to 50 skills).</p></div>
      <div className="signup-grid">{studentExtraFields.map(field => <ProfileField key={field.name} prefix="profile" field={{...field, required: false}} value={form[field.name]} onChange={change} />)}</div>
      {error && <p role="alert" className="text-rose-400">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving profile…" : "Save profile"}</button>
    </form>
    <AccountEmail email={student.email} />
  </section>;
}
