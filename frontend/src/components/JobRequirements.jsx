import { useState } from "react";
import { getJobKnowledge } from "../api";

export default function JobRequirements({ jobId }) {
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function open(event) {
    if (!event.currentTarget.open || documents || loading) return;
    setLoading(true); setError("");
    try { setDocuments((await getJobKnowledge(jobId)).documents || []); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  return <details className="candidate-details my-3" onToggle={open}><summary>View requirement policies</summary>
    {loading && <p>Loading requirements...</p>}{error && <p role="alert">{error} Close and reopen to retry.</p>}
    {documents?.length === 0 && <p>No additional policy documents. Refer to the job description.</p>}
    {documents?.map(document => <section key={document.document_id} className="my-3"><strong>{document.title}</strong><p className="text-sm text-slate-400">Indexed for student questions · version {document.revision}</p><div className="ai-text" style={{whiteSpace:"pre-wrap"}}>{document.content}</div></section>)}
  </details>;
}
