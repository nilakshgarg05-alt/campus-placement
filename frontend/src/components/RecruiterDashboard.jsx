import JobRequirements from "./JobRequirements";
import StaffProfile from "./StaffProfile";
import DashboardNavigation from "./DashboardNavigation";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  uploadKnowledgeFile,
  getAccount,
  getJobs,
  createRecruiterJob,
  getSkillMatches,
  getAIRecruiterMatch,
  getJobApplications,
  updateApplicationStatus,
} from "../api";

/* ─── Toast ────────────────────────────────────────────── */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className={`toast toast-${type}`}>{message}</div>;
}

/* ─── Main ─────────────────────────────────────────────── */
export default function RecruiterDashboard() {
  const [activeTab, setActiveTab] = useState("post");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "info") => setToast({ message, type }), []);

  const tabs = [
    { id: "profile", label: "My Profile" },
    { id: "post", label: "📝 Post Job" },
    { id: "jobs", label: "💼 View Jobs" },
    { id: "matches", label: "🎯 Skill Matches" },
    // { id: "ai", label: "🤖 AI Match" },
    { id: "applications", label: "📋 Applications" },
  ];

  return (
    <div className="dashboard-shell recruiter-theme">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <DashboardNavigation role="Recruiter" tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>

      </DashboardNavigation>

      <main id="dashboard-content" tabIndex={-1} className="dashboard-main animate-fade-in">
        {activeTab === "profile" && <StaffProfile />}
        {activeTab === "post" && <PostJobTab showToast={showToast} />}
        {activeTab === "jobs" && <ViewJobsTab />}
        {activeTab === "matches" && <SkillMatchesTab />}
        {activeTab === "ai" && <AIMatchTab />}
        {activeTab === "applications" && <ApplicationsTab showToast={showToast} />}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: Post Job
   ═══════════════════════════════════════════════════════ */
function PostJobTab({ showToast }) {
  const [company, setCompany] = useState(null);
  const [companyError, setCompanyError] = useState("");
  const [requirementFiles, setRequirementFiles] = useState([]);
  const indexedFiles = useRef(new Map());
  const [fileKey, setFileKey] = useState(0);
  const [form, setForm] = useState({
    job_title: "",
    min_cgpa: "",
    max_backlogs: "",
    eligible_branches: "",
    job_description: "",
    skills: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAccount()
      .then(account => {
        if (!account.profile?.company_id) throw new Error(account.company_error || "Contact your placement administrator to verify your company association.");
        setCompany(account.profile);
      })
      .catch(error => setCompanyError(error.message));
  }, []);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!company) throw new Error("Your registered company must be verified before posting.");
      if (requirementFiles.length > 5) throw new Error("Attach at most 5 requirement files.");
      const knowledgeIds = [];
      for (const file of requirementFiles) {
        if (file.size > 10 * 1024 * 1024) throw new Error("Each requirements file must be 10 MB or smaller.");
        if (!indexedFiles.current.has(file)) {
          const indexed = await uploadKnowledgeFile("job", `${form.job_title}: ${file.name}`.slice(0,200), file);
          indexedFiles.current.set(file, indexed.document_id);
        }
        knowledgeIds.push(indexedFiles.current.get(file));
      }
      const payload = {
        knowledge_document_ids: knowledgeIds,
        job_title: form.job_title,
        min_cgpa: Number(form.min_cgpa),
        max_backlogs: Number(form.max_backlogs),
        eligible_branches: form.eligible_branches,
        job_description: form.job_description,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      };
      const result = await createRecruiterJob(payload);
      setRequirementFiles([]); indexedFiles.current.clear(); setFileKey(value => value + 1);
      showToast(`Job created! ID: ${result.job_id} ✅`, "success");
      setForm({ job_title: "", min_cgpa: "", max_backlogs: "", eligible_branches: "", job_description: "", skills: "" });
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in-up max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Post a New Job</h2>
      <form onSubmit={handleSubmit} className="section-panel space-y-4">
        <div>
          <label htmlFor="recruiter-field-1" className="block text-sm text-slate-400 mb-1">Company</label>
          <input id="recruiter-field-1" className="input" value={company?.organization || ""} placeholder={companyError ? "Company unavailable" : "Loading registered company..."} readOnly />
          <p className="text-sm text-slate-400 mt-2">Jobs are posted for your registered company. This association cannot be changed.</p>
          {companyError && <p role="alert" className="text-rose-400 mt-2">{companyError}</p>}

        </div>

        <div>
          <label htmlFor="recruiter-field-2" className="block text-sm text-slate-400 mb-1">Job Title</label>
          <input id="recruiter-field-2" name="job_title" className="input" placeholder="e.g. Software Engineer" value={form.job_title} onChange={handleChange} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="recruiter-field-3" className="block text-sm text-slate-400 mb-1">Min CGPA</label>
            <input id="recruiter-field-3" name="min_cgpa" type="number" step="0.01" className="input" placeholder="7.0" value={form.min_cgpa} onChange={handleChange} required />
          </div>
          <div>
            <label htmlFor="recruiter-field-4" className="block text-sm text-slate-400 mb-1">Max Backlogs</label>
            <input id="recruiter-field-4" name="max_backlogs" type="number" className="input" placeholder="0" value={form.max_backlogs} onChange={handleChange} required />
          </div>
        </div>

        <div>
          <label htmlFor="recruiter-field-5" className="block text-sm text-slate-400 mb-1">Eligible Branches (comma-separated)</label>
          <input id="recruiter-field-5" name="eligible_branches" className="input" placeholder="CSE, IT, ECE" value={form.eligible_branches} onChange={handleChange} required />
        </div>

        <div>
          <label htmlFor="recruiter-field-6" className="block text-sm text-slate-400 mb-1">Job Description</label>
          <textarea id="recruiter-field-6" name="job_description" className="input" rows={4} placeholder="Describe the role…" value={form.job_description} onChange={handleChange} required />
        </div>

        <div>
          <label htmlFor="recruiter-field-7" className="block text-sm text-slate-400 mb-1">Required Skills (comma-separated)</label>
          <input id="recruiter-field-7" name="skills" className="input" placeholder="Python, React, SQL" value={form.skills} onChange={handleChange} required />
        </div>

        <div><label htmlFor="job-requirements">Job requirement policies (optional)</label>
          <input key={fileKey} id="job-requirements" type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,.json" disabled={loading} onChange={event => { setRequirementFiles(Array.from(event.target.files || [])); }} />
          <p className="text-sm text-slate-400 mt-2">Attach up to 5 files, 10 MB each: selection rounds, role requirements, bond terms, or application instructions. These become searchable by the student assistant only after the job is posted.</p>
          {requirementFiles.map((file,index) => <p key={index} className="text-sm">{file.name}</p>)}
        </div>
        <button type="submit" className="btn btn-success w-full" disabled={loading || !company}>
          {loading ? "Creating…" : "Post Job"}
        </button>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: View Jobs
   ═══════════════════════════════════════════════════════ */
function ViewJobsTab() {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJobs()
      .then((data) => setJobs(Array.isArray(data) ? data : data.jobs || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-overlay"><div className="spinner" /><span>Loading jobs…</span></div>;

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">Your Company's Jobs</h2>
      {error && <p role="alert" className="text-rose-400 mb-4">{error}</p>}
      {!error && jobs.length === 0 && <p className="mb-4">Your company has not posted any jobs yet.</p>}
      <div className="section-panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Company</th>
              <th>Title</th>
              <th>Min CGPA</th>
              <th>Max Backlogs</th>
              <th>Branches</th><th>Requirement policies</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.job_id}>
                <td>{j.job_id}</td>
                <td className="font-medium text-white">{j.company_name}</td>
                <td>{j.job_title}</td>
                <td>{j.min_cgpa}</td>
                <td>{j.max_backlogs}</td>
                <td><span className="badge badge-purple">{j.eligible_branches}</span></td><td><JobRequirements jobId={j.job_id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: Skill Matches
   ═══════════════════════════════════════════════════════ */
function SkillMatchesTab() {
  const [jobsError, setJobsError] = useState("");
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const { data: result, loading, error, refresh: handleSearch } = useLiveJobData(selectedJob, getSkillMatches);
  useEffect(() => {
    getJobs().then((data) => setJobs(Array.isArray(data) ? data : data.jobs || [])).catch(err => setJobsError(err.message));
  }, []);

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">Skill Match Analysis</h2>
      <p className="text-slate-400 mb-4">Select one of your company's jobs to see matching students. Matches use current student profiles and tech stacks. Results refresh every 30 seconds and when you return to this window.</p>
      {jobsError && <p role="alert" className="text-rose-400 mb-4">{jobsError}</p>}
      {error && <p role="alert" className="text-rose-400 mb-4">{error}</p>}
      <div className="section-panel">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="recruiter-field-8" className="block text-sm text-slate-400 mb-1">Select a Job</label>
            <select id="recruiter-field-8" className="select-input" value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)}>
              <option value="">Choose a job…</option>
              {jobs.map((j) => (
                <option key={j.job_id} value={j.job_id}>{j.company_name} — {j.job_title}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleSearch} disabled={!selectedJob || loading}>
            {loading ? "Loading…" : "Find Matches"}
          </button>
        </div>
      </div>

      {result && (
        <div className="section-panel mt-4 animate-fade-in-up">
          <div className="flex gap-2 mb-4">
            <span className="text-sm text-slate-400">Required Skills:</span>
            {result.required_skills?.map((s) => <span key={s} className="badge badge-blue">{s}</span>)}
          </div>

          {result.matches?.length === 0 ? (
            <p className="text-slate-500">No eligible candidates found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Branch</th>
                    <th>CGPA</th>
                    <th>Tech stack</th>
                    <th>Skill Match</th>
                    <th>Matched</th>
                    <th>Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {result.matches?.map((m) => (
                    <tr key={m.student_id}>
                      <td className="font-medium text-white">{m.name}<CandidateDetails details={m.profile_details} /></td>
                      <td>{m.branch}</td>
                      <td>{m.cgpa}</td>
                      <td>{m.skills?.join(", ") || "No skills added"}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="progress-bar w-20">
                            <div
                              className="progress-bar-fill"
                              style={{
                                width: `${m.skill_match}%`,
                                background: m.skill_match >= 70 ? "var(--gradient-green)" : m.skill_match >= 40 ? "var(--gradient-amber)" : "var(--gradient-purple)",
                              }}
                            />
                          </div>
                          <span className="text-sm">{m.skill_match}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {m.matched_skills?.map((s) => <span key={s} className="badge badge-green text-[10px]">{s}</span>)}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {m.missing_skills?.map((s) => <span key={s} className="badge badge-rose text-[10px]">{s}</span>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: AI Match
   ═══════════════════════════════════════════════════════ */
function AIMatchTab() {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getJobs()
      .then((data) => setJobs(Array.isArray(data) ? data : data.jobs || []))
      .catch(console.error);
  }, []);

  const handleMatch = async () => {
    if (!selectedJob) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await getAIRecruiterMatch(selectedJob);
      setResult(data);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">AI Candidate Matching</h2>
      <div className="section-panel">
        <p className="text-slate-400 mb-4">Use AI to analyze candidates against your job requirements. The AI will evaluate each candidate's skills and provide detailed assessments.</p>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="recruiter-field-9" className="block text-sm text-slate-400 mb-1">Select a Job</label>
            <select id="recruiter-field-9" className="select-input" value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)}>
              <option value="">Choose a job…</option>
              {jobs.map((j) => (
                <option key={j.job_id} value={j.job_id}>{j.company_name} — {j.job_title}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-purple" onClick={handleMatch} disabled={!selectedJob || loading}>
            {loading ? "Analyzing…" : "Run AI Analysis"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-overlay mt-6">
          <div className="spinner" />
          <span>AI is analyzing candidates… This may take a moment.</span>
        </div>
      )}

      {result && !result.error && (
        <div className="section-panel mt-4 animate-fade-in-up">
          <h3 className="text-lg font-semibold mb-3">AI Analysis</h3>
          <div className="ai-text">{result.ai_analysis}</div>
        </div>
      )}

      {result && result.error && (
        <div className="section-panel mt-4 text-rose-400">{result.error}</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: Applications Management
   ═══════════════════════════════════════════════════════ */
function ApplicationsTab({ showToast }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const { data, loading, error, refresh: loadApplications } = useLiveJobData(selectedJob, getJobApplications);
  const applications = data?.applications || [];
  useEffect(() => {
    getJobs().then((data) => setJobs(Array.isArray(data) ? data : data.jobs || []))
      .catch((err) => showToast(err.message, "error"));
  }, [showToast]);
  const updateStatus = async (applicationId, status) => {
    try {
      await updateApplicationStatus(applicationId, status);
      await loadApplications();
      showToast("Application status updated", "success");
    } catch (err) { showToast(err.message, "error"); }
  };

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">Applications</h2>
      <p className="text-slate-400 mb-4">Review the latest candidate profiles. This list refreshes every 30 seconds and when you return to this window.</p>
      {error && <p role="alert" className="text-rose-400 mb-4">{error}</p>}
      <div className="section-panel">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="recruiter-field-10" className="block text-sm text-slate-400 mb-1">Select a Job</label>
            <select id="recruiter-field-10"
              className="select-input"
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
            >
              <option value="">Choose a job…</option>
              {jobs.map((j) => (
                <option key={j.job_id} value={j.job_id}>
                  {j.company_name} — {j.job_title}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={loadApplications} disabled={!selectedJob || loading}>
            {loading ? "Loading…" : "View Applications"}
          </button>
        </div>
      </div>

      {applications.length === 0 && selectedJob && !loading && (
        <div className="section-panel text-slate-500">No applications found for this job.</div>
      )}

      {applications.length > 0 && (
        <div className="section-panel overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Branch</th>
                <th>CGPA</th>
                <th>Backlogs</th>
                <th>Tech stack</th>
                <th>Status</th>
                <th>Update</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.application_id}>
                  <td className="font-medium text-white">{application.name}<CandidateDetails details={application.profile_details} /></td>
                  <td>{application.email}</td>
                  <td>{application.branch}</td>
                  <td>{application.cgpa}</td>
                  <td>{application.backlogs}</td>
                  <td>{application.skills?.join(", ") || "No skills added"}</td>
                  <td>
                    <span className="badge badge-blue">{application.status}</span>
                  </td>
                  <td>
                    <select
                      className="select-input min-w-[140px]"
                      value={application.status}
                      onChange={(e) => updateStatus(application.application_id, e.target.value)}
                    >
                      {["Applied", "Shortlisted", "Interview", "Selected", "Rejected"].map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Keep open recruiter views current when candidates save their profiles.
function useLiveJobData(jobId, fetchData) {
  const [state, setState] = useState({ jobId: null, data: null, loading: false, error: "" });
  const requestState = useRef({ version: 0 });
  const refresh = useCallback(async () => {
    if (!jobId) return;
    const requests = requestState.current;
    const id = ++requests.version;
    setState((previous) => ({ jobId, data: previous.jobId === jobId ? previous.data : null, error: "", loading: true }));
    try {
      const data = await fetchData(jobId);
      if (id === requests.version) setState({ jobId, data, loading: false, error: "" });
    } catch (err) {
      if (id === requests.version) setState({ jobId, data: null, loading: false, error: err.message });
    }
  }, [jobId, fetchData]);
  useEffect(() => {
    const requests = requestState.current;
    // eslint-disable-next-line react/set-state-in-effect -- Synchronize loading state with a new API request.
    refresh();
    const interval = setInterval(() => { if (!document.hidden) refresh(); }, 30000);
    window.addEventListener("focus", refresh);
    return () => { ++requests.version; clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [refresh]);
  return { ...(state.jobId === jobId ? state : { data: null, loading: Boolean(jobId), error: "" }), refresh };
}

function CandidateDetails({ details }) {
  if (!details || !Object.values(details).some(Boolean)) return null;
  return <details className="candidate-details"><summary>View profile details</summary>
    {Object.entries(details).filter(([,value]) => value).map(([key,value]) => <p key={key}><strong>{key.replaceAll("_", " ")}: </strong>{String(value)}</p>)}
  </details>;
}
