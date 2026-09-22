import { useEffect, useState } from "react";
import { getCampusPolicies, publishCampusPolicy, reviseCampusPolicy, archiveCampusPolicy, uploadKnowledgeFile } from "../api";

export default function CampusPolicies() {
  const [policies, setPolicies] = useState([]);
  const [form, setForm] = useState({title: "", content: ""});
  const [editing, setEditing] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState(false);
  async function refresh() { setPolicies((await getCampusPolicies()).policies || []); }
  useEffect(() => { getCampusPolicies().then(data => setPolicies(data.policies || [])).catch(err => setError(err.message)); }, []);
  function reset() { setForm({title: "", content: ""}); setEditing(null); setFile(null); }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (editing) await reviseCampusPolicy(editing, form);
      else if (file) await uploadKnowledgeFile("campus", form.title, file);
      else await publishCampusPolicy(form);
      reset(); await refresh(); setNotice("Policy published and indexed. New assistant answers will use this version.");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function archive(policy) {
    setBusy(true); setError(""); setNotice("");
    try { await archiveCampusPolicy(policy.document_id); if (editing === policy.document_id) reset(); await refresh(); setNotice("Policy archived. It is excluded from new answers."); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section><h2 className="text-2xl font-bold">Campus policies</h2>
    <p className="text-slate-400 my-4">Publish campus-wide placement rules. Students receive answers from the latest active policies with source citations.</p>
    <form className="section-panel space-y-4" onSubmit={save}><h3>{editing ? "Publish a revised policy" : "Add a campus policy"}</h3>
      <div><label htmlFor="policy-title">Policy title</label><input id="policy-title" className="input" value={form.title} onChange={event => setForm(current => ({...current, title: event.target.value}))} required maxLength={200} /></div>
      {!editing && <div><label htmlFor="policy-file">Import policy file (optional)</label><input key={file?.name || "empty"} id="policy-file" type="file" accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={event => { setFile(event.target.files?.[0] || null); }} /><p className="text-sm text-slate-400">Up to 10 MB. Select a text-based document or write the policy below.</p></div>}
      {!file && <div><label htmlFor="policy-content">Policy text</label><textarea id="policy-content" className="input" rows={8} value={form.content} onChange={event => setForm(current => ({...current, content: event.target.value}))} required maxLength={120000} placeholder="Attendance requirements, placement eligibility, application rules, deadlines..." /></div>}
      {file && <p>Ready to index: {file.name} <button type="button" className="btn btn-ghost" onClick={() => setFile(null)}>Remove file</button></p>}
      <div className="flex gap-3"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving..." : editing ? "Publish new version" : "Publish policy"}</button>{editing && <button type="button" className="btn btn-ghost" disabled={busy} onClick={reset}>Cancel edit</button>}</div>
    </form>
    {error && <p role="alert" className="text-rose-400 my-4">{error}</p>}{notice && <p role="status" className="my-4">{notice}</p>}
    <div className="flex gap-3 my-4"><label><input type="checkbox" checked={history} onChange={event => setHistory(event.target.checked)} /> Show archived versions</label><button className="btn btn-ghost" onClick={() => refresh().catch(err => setError(err.message))}>Refresh policies</button></div>
    {policies.filter(policy => history || policy.active).map(policy => <article className="section-panel" key={policy.document_id}>
      <h3>{policy.title}</h3><p className="text-sm text-slate-400">Version {policy.revision} · {policy.active ? "Published · used by assistant" : "Archived · excluded from answers"} · {new Date(policy.updated_at).toLocaleString()}</p>
      <details className="my-4"><summary>Read indexed policy</summary><div className="ai-text" style={{whiteSpace:"pre-wrap"}}>{policy.content}</div></details>
      {policy.active && <div className="flex gap-3"><button className="btn btn-ghost" disabled={busy} onClick={() => { setEditing(policy.document_id); setFile(null); setForm({title:policy.title, content:policy.content}); window.scrollTo({top:0,behavior:"smooth"}); }}>Edit policy</button><button className="btn btn-ghost" disabled={busy} onClick={() => archive(policy)}>Archive policy</button></div>}
    </article>)}
    {!policies.length && <p className="section-panel">No policies published yet. Add your first policy above.</p>}
  </section>;
}
