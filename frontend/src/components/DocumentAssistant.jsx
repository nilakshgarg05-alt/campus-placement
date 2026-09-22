import { useCallback, useEffect, useRef, useState } from "react";
import { askDocumentAssistant, getPlacementDocuments, uploadPlacementDocument } from "../api";
import { Icon } from "./DashboardNavigation";

const supportedDocuments = ".pdf,.docx,.txt,.md,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/json";

export default function DocumentAssistant({ scope, studentId = null, title = "Document assistant" }) {
  const [documents, setDocuments] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const conversationRef = useRef(null);

  const refreshDocuments = useCallback(async () => {
    setLoadingDocuments(true);
    try {
      const result = await getPlacementDocuments(scope, studentId);
      const nextDocuments = result.documents || [];
      setDocuments(nextDocuments);
      setSelectedIds((current) => current.filter((id) => nextDocuments.some((document) => document.document_id === id)));
    } catch (err) {
      setError(err.message || "Could not load uploaded documents.");
    } finally {
      setLoadingDocuments(false);
    }
  }, [scope, studentId]);

  useEffect(() => {
    const request = window.setTimeout(() => { void refreshDocuments(); }, 0);
    return () => window.clearTimeout(request);
  }, [refreshDocuments]);

  useEffect(() => {
    const container = conversationRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, asking]);

  const toggleDocument = (documentId) => {
    setSelectedIds((current) => current.includes(documentId)
      ? current.filter((id) => id !== documentId)
      : [...current, documentId]);
  };

  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = await uploadPlacementDocument(scope, file, studentId);
      setDocuments((current) => [...current, uploaded].sort((a, b) => a.filename.localeCompare(b.filename)));
      setSelectedIds((current) => [...new Set([...current, uploaded.document_id])]);
      setFile(null);
    } catch (err) {
      setError(err.message || "The document could not be uploaded.");
    } finally {
      setUploading(false);
    }
  };

  const ask = async (event, prompt = null) => {
    event?.preventDefault();
    const text = (prompt || question).trim();
    if (!text || !selectedIds.length || asking) return;
    setMessages((current) => [...current, { role: "user", text }]);
    setQuestion("");
    setAsking(true);
    setError("");
    try {
      const result = await askDocumentAssistant(scope, text, selectedIds, studentId);
      setMessages((current) => [...current, { role: "assistant", text: result.answer, sources: result.sources || [] }]);
    } catch (err) {
      const message = err.message || "I could not analyze the selected documents.";
      setMessages((current) => [...current, { role: "assistant", text: message }]);
      setError(message);
    } finally {
      setAsking(false);
    }
  };

  return (
    <section className="section-panel document-assistant">
      <div className="document-assistant-header">
        <span className="brand-mark"><Icon name="documents" /></span>
        <div>
          <h3>{title}</h3>
          <p>Upload a file, choose it below, and ask questions grounded only in its content. Your uploaded documents are also visible to the placement team.</p>
        </div>
      </div>

      <div className="document-upload-row">
        <label className="document-picker">
          <Icon name="documents" size={18} />
          <span>{file ? file.name : "Choose a document"}</span>
          <input type="file" accept={supportedDocuments} onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>
        <button className="btn btn-primary" type="button" onClick={upload} disabled={!file || uploading}>
          {uploading ? "Uploading…" : "Upload document"}
        </button>
      </div>
      <p className="document-help">PDF, DOCX, TXT, MD, CSV, or JSON · maximum 10 MB · scanned or password-protected PDFs cannot be read.</p>

      <div className="document-library" aria-label="Uploaded documents">
        <div className="document-library-heading"><strong>Document library</strong><span>{loadingDocuments ? "Loading…" : `${documents.length} uploaded`}</span></div>
        {!loadingDocuments && documents.length === 0 && <p className="document-empty">No documents yet. Upload a placement policy, job brief, study material, or your own notes.</p>}
        {documents.map((document) => (
          <label className={`document-choice ${selectedIds.includes(document.document_id) ? "selected" : ""}`} key={document.document_id}>
            <input type="checkbox" checked={selectedIds.includes(document.document_id)} onChange={() => toggleDocument(document.document_id)} />
            <span className="document-file-icon"><Icon name="resume" size={17} /></span>
            <span><strong>{document.filename}</strong><small>{Math.max(1, Math.round(document.size_bytes / 1024))} KB · ready to search</small></span>
            <span className="document-check">✓</span>
          </label>
        ))}
      </div>

      {documents.length > 0 && <div className="document-actions"><button type="button" className="btn btn-ghost" onClick={(event) => ask(event, "Summarize the selected documents with the most important points, requirements, dates, and actions.")} disabled={!selectedIds.length || asking}>Summarize selected</button><span>{selectedIds.length ? `${selectedIds.length} selected` : "Select at least one document"}</span></div>}

      {messages.length > 0 && <div ref={conversationRef} className="document-conversation" role="log" aria-live="polite">
        {messages.map((message, index) => <div className={`chat-message ${message.role === "user" ? "chat-message-user" : "chat-message-assistant"}`} key={`${message.role}-${index}`}><p className="chat-author">{message.role === "user" ? "You" : "Document assistant"}</p><div className="ai-text">{message.text}</div>{message.sources?.length > 0 && <p className="document-sources">Sources: {message.sources.join(", ")}</p>}</div>)}
        {asking && <div className="chat-thinking" role="status">Reading the selected documents…</div>}
      </div>}

      <form className="document-composer" onSubmit={ask}>
        <input className="input" value={question} onChange={(event) => setQuestion(event.target.value)} disabled={!selectedIds.length || asking} placeholder={selectedIds.length ? "Ask a question about the selected documents…" : "Select a document to start asking questions"} />
        <button className="btn btn-primary" type="submit" disabled={!question.trim() || !selectedIds.length || asking}>{asking ? "Analyzing…" : "Ask document"}</button>
      </form>
      {error && <p className="document-error" role="alert">{error}</p>}
    </section>
  );
}
