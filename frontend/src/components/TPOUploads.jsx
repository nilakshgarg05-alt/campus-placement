import { useCallback, useEffect, useRef, useState } from "react";
import { getTPOUploads, previewTPOUpload, downloadTPOUpload } from "../api";

export default function TPOUploads() {
  const [documents, setDocuments] = useState([]);
  const [scope, setScope] = useState("");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const previewRequest = useRef(0);
  const refresh = useCallback(async () => {
    setBusy(true); setError("");
    try { setDocuments((await getTPOUploads()).documents || []); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  async function open(item) {
    const id = ++previewRequest.current;
    setPreview({filename: item.filename, text: "Loading preview..."}); setError("");
    try { const result = await previewTPOUpload(item); if (id === previewRequest.current) setPreview(result); }
    catch (err) { if (id === previewRequest.current) { setError(err.message); setPreview(null); } }
  }
  async function download(item) {
    setError("");
    try {
      const blob = await downloadTPOUpload(item);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = item.filename;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err.message); }
  }
  const visible = documents.filter(item => (!scope || item.scope === scope) &&
    `${item.filename} ${item.owner_name} ${item.owner_email}`.toLowerCase().includes(search.toLowerCase()));
  return <section><h2 className="text-2xl font-bold">Student & recruiter uploads</h2>
    <p className="text-slate-400 my-4">Review shared placement documents and student resume uploads.</p>
    <div className="section-panel flex flex-wrap gap-3">
      <input className="input" aria-label="Search uploads" placeholder="Search file, name, or email" value={search} onChange={event => setSearch(event.target.value)} />
      <select className="select-input" aria-label="Filter upload role" value={scope} onChange={event => setScope(event.target.value)}><option value="">All uploaders</option><option value="student">Students</option><option value="recruiter">Recruiters</option></select>
      <button className="btn btn-primary" disabled={busy} onClick={refresh}>{busy ? "Loading..." : "Refresh uploads"}</button>
    </div>
    {error && <p role="alert" className="text-rose-400 my-4">{error}</p>}
    {!busy && !visible.length && <p className="section-panel">No matching uploads found.</p>}
    {visible.map(item => <article className="section-panel" key={`${item.kind}-${item.scope}-${item.student_id}-${item.document_id}`}>
      <h3>{item.filename}</h3><p className="text-slate-400">{item.scope === "student" ? "Student" : "Recruiter"} · {item.owner_name} · {item.owner_email}</p>
      <p className="text-sm my-2">{item.kind === "resume" ? "Resume" : "Document"}{item.uploaded_at ? ` · ${new Date(item.uploaded_at).toLocaleString()}` : ""}</p>
      <div className="flex gap-3"><button className="btn btn-ghost" onClick={() => open(item)}>Preview text</button><button className="btn btn-ghost" onClick={() => download(item)}>Download file</button></div>
    </article>)}
    {preview && <section className="section-panel" aria-label="Document preview"><div className="flex justify-between gap-3"><h3>{preview.filename}</h3><button className="btn btn-ghost" onClick={() => { ++previewRequest.current; setPreview(null); }}>Close preview</button></div><pre className="ai-text" style={{whiteSpace: "pre-wrap", overflowWrap: "anywhere"}}>{preview.text}</pre></section>}
  </section>;
}
