import JobRequirements from "./JobRequirements";
import StudentProfile from "./StudentProfile";
import DashboardNavigation, { Icon } from "./DashboardNavigation";
import DocumentAssistant from "./DocumentAssistant";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  getMyProfile,
  getJobs,
  checkEligibility,
  applyForJob,
  getStudentApplications,
  getReadiness,
  getCompanyPreparation,
  startInterview,
  answerInterview,
  finishInterview,
  analyzeResume,
  generateResume,
  downloadResumePdf,
  askPlacementAssistant,
} from "../api";

/* ─── Toast helper ───── */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className={`toast toast-${type}`}>{message}</div>;
}

/* ─── Main Dashboard ──────────────────────────────────── */
function StudentDashboard() {
  const [profileVersion, setProfileVersion] = useState(0);
  const [profileError, setProfileError] = useState("");
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    getMyProfile()
      .then(setStudent)
      .catch((err) => setProfileError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="status-page">
        <a className="btn btn-ghost" href="/">&larr; Back to workspaces</a>
        <div className="loading-overlay">
          <div className="spinner" />
          <span>Loading student data…</span>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="status-page">
        <h1 className="text-3xl font-bold">Student Dashboard</h1>
        <p className="text-slate-400 mt-4">{profileError || "Your profile is unavailable. Please try again shortly."}</p>
        <a className="btn btn-ghost mt-6" href="/">&larr; Back to workspaces</a>
      </div>
    );
  }

  const tabs = [
    { id: "profile", label: "My Profile" },
    { id: "overview", label: "📊 Overview" },
    { id: "jobs", label: "💼 Find Jobs" },
    { id: "applications", label: "📄 My Applications" },
    { id: "readiness", label: "🎯 Readiness" },
    { id: "preparation", label: "📚 Company Prep" },
    { id: "interview", label: "🤖 AI Interview" },
    { id: "resume", label: "📝 Resume AI" },
    { id: "builder", label: "📄 Resume Builder" },
    { id: "assistant", label: "💬 Placement Assistant" },
  ];

  return (
    <div className="dashboard-shell student-theme">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <DashboardNavigation role="Student" tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
          <span className="workspace-badge">{student.name}</span>
      </DashboardNavigation>

      <main key={profileVersion} id="dashboard-content" tabIndex={-1} className="dashboard-main animate-fade-in">
        {activeTab === "profile" && <StudentProfile student={student} onSaved={(profile) => {
          setStudent(profile); setProfileVersion((version) => version + 1);
          showToast("Profile saved. Your matching and preparation now use your latest details.", "success");
        }} />}
        {activeTab === "overview" && <OverviewTab student={student} />}
        {activeTab === "jobs" && <JobsTab student={student} showToast={showToast} />}
        {activeTab === "applications" && <ApplicationsTab student={student} />}
        {activeTab === "readiness" && <ReadinessTab student={student} />}
        {activeTab === "preparation" && <PreparationTab student={student} />}
        {activeTab === "interview" && <InterviewTab student={student} />}
        {activeTab === "resume" && <ResumeTab student={student} />}
        {activeTab === "builder" && <ResumeBuilderTab student={student} />}
        {activeTab === "assistant" && <PlacementAssistantTab student={student} />}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: Overview
   ═══════════════════════════════════════════════════════ */
function OverviewTab({ student }) {
  return (
    <div className="animate-fade-in-up">
      <h2 className="text-3xl font-bold">
        Welcome, {student.name} <span className="inline-block">👋</span>
      </h2>
      <p className="text-slate-400 mt-2 mb-8">Manage your placement preparation and applications.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 stagger">
        <div className="stat-card blue animate-fade-in-up">
          <p className="text-slate-400 text-sm">CGPA</p>
          <p className="text-4xl font-extrabold mt-2 animate-count-up">{student.cgpa}</p>
        </div>
        <div className="stat-card green animate-fade-in-up">
          <p className="text-slate-400 text-sm">Branch</p>
          <p className="text-2xl font-bold mt-2">{student.branch}</p>
        </div>
        <div className="stat-card purple animate-fade-in-up">
          <p className="text-slate-400 text-sm">Backlogs</p>
          <p className="text-4xl font-extrabold mt-2 animate-count-up">{student.backlogs}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-8 stagger">
        <div className="section-panel">
          <h3>📧 Contact</h3>
          <p className="text-slate-400">{student.email}</p>
          {student.phone && <p className="text-slate-400 mt-1">📱 {student.phone}</p>}
        </div>
        <div className="section-panel">
          <h3>🆔 Student ID</h3>
          <p className="text-slate-400 text-3xl font-bold">{student.student_id}</p>
        </div>
      </div>
      <div className="section-panel mt-5"><h3>My tech stack</h3><div className="flex flex-wrap gap-2">{student.skills?.length ? student.skills.map((skill) => <span className="badge badge-blue" key={skill}>{skill}</span>) : <p className="text-slate-400">Add your skills in My Profile to improve your matches.</p>}</div></div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: Find Jobs
   ═══════════════════════════════════════════════════════ */
function JobsTab({ student, showToast }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState({});
  const [applying, setApplying] = useState({});

  useEffect(() => {
    getJobs()
      .then((data) => setJobs(Array.isArray(data) ? data : data.jobs || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleCheckEligibility = async (jobId) => {
    try {
      const result = await checkEligibility(student.student_id, jobId);
      setEligibility((prev) => ({ ...prev, [jobId]: result }));
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleApply = async (jobId) => {
    setApplying((prev) => ({ ...prev, [jobId]: true }));
    try {
      const result = await applyForJob(student.student_id, jobId);
      if (result.already_applied) { showToast(result.message, "info"); return; }
      showToast("Application submitted! ✅", "success");
    } catch (err) {
      showToast(err.message || "Could not apply", "error");
    } finally {
      setApplying((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" /><span>Loading jobs…</span></div>;

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">Available Jobs</h2>
      {jobs.length === 0 ? (
        <p className="text-slate-500">No jobs found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 stagger">
          {jobs.map((job) => {
            const elig = eligibility[job.job_id];
            return (
              <div key={job.job_id} className="section-panel animate-fade-in-up">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">{job.job_title}</h3>
                    <p className="text-blue-400 text-sm">{job.company_name}</p>
                  </div>
                  <span className="badge badge-blue">ID #{job.job_id}</span>
                </div>
                <p className="text-slate-400 text-sm mb-2">{job.job_description?.slice(0, 120)}…</p>
                <div className="flex gap-2 text-xs text-slate-500 mb-4">
                  <span className="badge badge-green">CGPA ≥ {job.min_cgpa}</span>
                  <span className="badge badge-amber">Backlogs ≤ {job.max_backlogs}</span>
                  <span className="badge badge-purple">{job.eligible_branches}</span>
                </div>

                <JobRequirements jobId={job.job_id} />
                <div className="flex gap-2 flex-wrap">
                  <button className="btn btn-ghost text-xs" onClick={() => handleCheckEligibility(job.job_id)}>
                    Check Eligibility
                  </button>
                  {elig && elig.eligible && (
                    <button
                      className="btn btn-success text-xs"
                      disabled={applying[job.job_id]}
                      onClick={() => handleApply(job.job_id)}
                    >
                      {applying[job.job_id] ? "Applying…" : "Apply Now"}
                    </button>
                  )}
                </div>

                {elig && (
                  <div className={`mt-3 p-3 rounded-lg text-sm ${elig.eligible ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                    {elig.eligible ? "✅ You are eligible!" : "❌ Not eligible"}
                    <div className="flex gap-2 mt-1 text-xs">
                      <span>CGPA: {elig.checks?.cgpa ? "✓" : "✗"}</span>
                      <span>Backlogs: {elig.checks?.backlogs ? "✓" : "✗"}</span>
                      <span>Branch: {elig.checks?.branch ? "✓" : "✗"}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: My Applications
   ═══════════════════════════════════════════════════════ */
function ApplicationsTab({ student }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentApplications(student.student_id)
      .then((data) => setApps(data.applications || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [student.student_id]);

  if (loading) return <div className="loading-overlay"><div className="spinner" /><span>Loading applications…</span></div>;

  const statusColor = (s) => {
    if (s === "Selected" || s === "Placed") return "badge-green";
    if (s === "Rejected") return "badge-rose";
    if (s === "Shortlisted" || s === "Interview") return "badge-amber";
    return "badge-blue";
  };

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">My Applications</h2>
      {apps.length === 0 ? (
        <p className="text-slate-500">No applications yet. Go to "Find Jobs" to apply!</p>
      ) : (
        <div className="section-panel overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Job Title</th>
                <th>Status</th>
                <th>Applied At</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.application_id}>
                  <td className="font-medium text-white">{app.company_name}</td>
                  <td>{app.job_title}</td>
                  <td><span className={`badge ${statusColor(app.status)}`}>{app.status}</span></td>
                  <td>{app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: Readiness Score
   ═══════════════════════════════════════════════════════ */
function ReadinessTab({ student }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getJobs()
      .then((data) => setJobs(Array.isArray(data) ? data : data.jobs || []))
      .catch(console.error);
  }, []);

  const handleCheck = async () => {
    if (!selectedJob) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await getReadiness(student.student_id, selectedJob);
      setResult(data);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (s) => {
    if (s >= 80) return "#10b981";
    if (s >= 60) return "#f59e0b";
    if (s >= 40) return "#f97316";
    return "#f43f5e";
  };

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">Readiness Score</h2>
      <div className="section-panel">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="student-field-1" className="block text-sm text-slate-400 mb-1">Select a Job</label>
            <select id="student-field-1" className="select-input" value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)}>
              <option value="">Choose a job…</option>
              {jobs.map((j) => (
                <option key={j.job_id} value={j.job_id}>
                  {j.company_name} — {j.job_title}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleCheck} disabled={!selectedJob || loading}>
            {loading ? "Calculating…" : "Check Readiness"}
          </button>
        </div>
      </div>

      {result && !result.error && (
        <div className="section-panel mt-4 animate-fade-in-up">
          <div className="flex items-center gap-6 mb-6">
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(30,41,59,0.5)" strokeWidth="3" />
                <path
                  d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={scoreColor(result.readiness_score)}
                  strokeWidth="3"
                  strokeDasharray={`${result.readiness_score}, 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-extrabold" style={{ color: scoreColor(result.readiness_score) }}>
                  {result.readiness_score}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xl font-bold">{result.recommendation}</p>
              <p className="text-slate-400 text-sm mt-1">
                Skill match: {result.skill_match_percentage}% · CGPA score: {result.cgpa_score}/20 · Backlog score: {result.backlog_score}/10
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-emerald-400 mb-2">✅ Matching Skills</h4>
              <div className="flex flex-wrap gap-1.5">
                {result.matching_skills?.length > 0
                  ? result.matching_skills.map((s) => <span key={s} className="badge badge-green">{s}</span>)
                  : <span className="text-slate-500 text-sm">None</span>}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-rose-400 mb-2">❌ Missing Skills</h4>
              <div className="flex flex-wrap gap-1.5">
                {result.missing_skills?.length > 0
                  ? result.missing_skills.map((s) => <span key={s} className="badge badge-rose">{s}</span>)
                  : <span className="text-slate-500 text-sm">None</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {result && result.error && (
        <div className="section-panel mt-4 text-rose-400">{result.error}</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: Company Preparation (AI)
   ═══════════════════════════════════════════════════════ */
function PreparationTab({ student }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getJobs()
      .then((data) => setJobs(Array.isArray(data) ? data : data.jobs || []))
      .catch(console.error);
  }, []);

  const handlePrepare = async () => {
    if (!selectedJob) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await getCompanyPreparation(student.student_id, selectedJob);
      setResult(data);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">Company Preparation</h2>
      <div className="section-panel">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="student-field-2" className="block text-sm text-slate-400 mb-1">Select a Job</label>
            <select id="student-field-2" className="select-input" value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)}>
              <option value="">Choose a job…</option>
              {jobs.map((j) => (
                <option key={j.job_id} value={j.job_id}>{j.company_name} — {j.job_title}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-purple" onClick={handlePrepare} disabled={!selectedJob || loading}>
            {loading ? "Generating Plan…" : "Get AI Preparation Plan"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-overlay mt-6">
          <div className="spinner" />
          <span>AI is generating your preparation plan… This may take a moment.</span>
        </div>
      )}

      {result && !result.error && (
        <div className="section-panel mt-4 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <span className="badge badge-purple">{result.company}</span>
            <span className="badge badge-blue">{result.job_title}</span>
          </div>
          <div className="ai-text">{result.preparation}</div>
        </div>
      )}

      {result && result.error && (
        <div className="section-panel mt-4 text-rose-400">{result.error}</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: AI Interview
   ═══════════════════════════════════════════════════════ */
function InterviewTab({ student }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [interview, setInterview] = useState(null);
  const [currentQ, setCurrentQ] = useState(null);
  const [answer, setAnswer] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(null);

  useEffect(() => {
    getJobs()
      .then((data) => setJobs(Array.isArray(data) ? data : data.jobs || []))
      .catch(console.error);
  }, []);

  const handleStart = async () => {
    if (!selectedJob) return;
    setLoading(true);
    setFinished(null);
    setHistory([]);
    try {
      const data = await startInterview(student.student_id, selectedJob);
      setInterview(data);
      setCurrentQ({ question_id: data.question_id, question: data.question });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async () => {
    if (!answer.trim() || !currentQ) return;
    setLoading(true);
    try {
      const data = await answerInterview(interview.interview_id, currentQ.question_id, answer);
      setHistory((prev) => [
        ...prev,
        { question: currentQ.question, answer, score: data.score, evaluation: data.evaluation },
      ]);
      setAnswer("");

      if (data.next_question && data.next_question_id) {
        setCurrentQ({
          question_id: data.next_question_id,
          question: data.next_question,
        });
      } else {
        setCurrentQ(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!interview) return;
    setLoading(true);
    try {
      const data = await finishInterview(interview.interview_id);
      setFinished(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">AI Mock Interview</h2>

      {!interview && (
        <div className="section-panel">
          <p className="text-slate-400 mb-4">Select a job to start a practice interview. The AI will ask technical questions based on the job requirements.</p>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="student-field-3" className="block text-sm text-slate-400 mb-1">Select a Job</label>
              <select id="student-field-3" className="select-input" value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)}>
                <option value="">Choose a job…</option>
                {jobs.map((j) => (
                  <option key={j.job_id} value={j.job_id}>{j.company_name} — {j.job_title}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleStart} disabled={!selectedJob || loading}>
              {loading ? "Starting…" : "Start Interview"}
            </button>
          </div>
        </div>
      )}

      {interview && (
        <div>
          <div className="flex gap-2 mb-4">
            <span className="badge badge-blue">{interview.company}</span>
            <span className="badge badge-purple">{interview.job_title}</span>
          </div>

          {/* History */}
          {history.map((h, i) => (
            <div key={i} className="section-panel animate-fade-in-up mb-3">
              <p className="text-sm text-slate-400 mb-1">Question {i + 1}</p>
              <p className="font-medium mb-2">{h.question}</p>
              <p className="text-sm text-cyan-400 mb-1">Your Answer:</p>
              <p className="text-slate-300 text-sm mb-3">{h.answer}</p>
              {h.score !== null && (
                <span className={`badge ${h.score >= 7 ? "badge-green" : h.score >= 4 ? "badge-amber" : "badge-rose"}`}>
                  Score: {h.score}/10
                </span>
              )}
            </div>
          ))}

          {/* Current question */}
          {currentQ && (
            <div className="section-panel animate-slide-in-right">
              <p className="text-sm text-slate-400 mb-1">Question {history.length + 1}</p>
              <p className="text-lg font-medium mb-4">{currentQ.question}</p>
              <textarea
                className="input mb-3"
                rows={4}
                placeholder="Type your answer here…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <button className="btn btn-primary" onClick={handleAnswer} disabled={!answer.trim() || loading}>
                {loading ? "Submitting…" : "Submit Answer"}
              </button>
            </div>
          )}

          {/* No more questions — finish */}
          {!currentQ && !finished && interview && (
            <div className="section-panel text-center">
              <p className="text-slate-400 mb-4">Interview round complete. Click below to get your final score.</p>
              <button className="btn btn-success" onClick={handleFinish} disabled={loading}>
                {loading ? "Finishing…" : "Finish Interview"}
              </button>
            </div>
          )}

          {/* Final score */}
          {finished && (
            <div className="section-panel animate-fade-in-up text-center">
              <p className="text-lg font-bold mb-2">🎉 Interview Complete</p>
              <p className="text-5xl font-extrabold text-blue-400 animate-count-up">{finished.final_score}/10</p>
              <p className="text-slate-400 mt-2">Questions answered: {finished.questions_answered}</p>
              <button className="btn btn-ghost mt-4" onClick={() => { setInterview(null); setCurrentQ(null); setHistory([]); setFinished(null); }}>
                Start New Interview
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: Resume AI
   ═══════════════════════════════════════════════════════ */
function ResumeTab({ student }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await analyzeResume(student.student_id, file);
      setResult(data);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">Resume Analyzer</h2>
      <div className="section-panel">
        <p className="text-slate-400 mb-4">Upload your resume (PDF) to get an AI-powered analysis with score, strengths, and improvement suggestions.</p>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1">
            <label htmlFor="student-field-4" className="block text-sm text-slate-400 mb-1">Upload Resume (PDF)</label>
            <input id="student-field-4"
              type="file"
              accept="application/pdf"
              className="input"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <button className="btn btn-primary" onClick={handleUpload} disabled={!file || loading}>
            {loading ? "Analyzing…" : "Analyze Resume"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-overlay mt-6">
          <div className="spinner" />
          <span>AI is analyzing your resume… This may take a moment.</span>
        </div>
      )}

      {result && !result.error && (
        <div className="section-panel mt-4 animate-fade-in-up">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-3xl font-extrabold text-blue-400 animate-count-up">
              {result.resume_score !== null ? `${result.resume_score}/100` : "N/A"}
            </span>
            <span className="badge badge-cyan">{result.filename}</span>
          </div>
          <div className="ai-text">{result.resume_analysis}</div>
        </div>
      )}

      {result && result.error && (
        <div className="section-panel mt-4 text-rose-400">{result.error}</div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   TAB: Resume Builder
   ═══════════════════════════════════════════════════════ */
function ResumeBuilderTab({ student }) {
  const [resume, setResume] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await generateResume(student.student_id);
      setResume(data.resume || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      const blob = await downloadResumePdf(student.student_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `student_${student.student_id}_resume.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">AI Resume Builder</h2>
      <div className="section-panel">
        <p className="text-slate-400 mb-4">
          Generate an ATS-friendly resume from the profile, skills, projects and certifications stored for this student.
        </p>
        <div className="flex gap-3 flex-wrap">
          <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating…" : "Generate Resume"}
          </button>
          <button className="btn btn-ghost" onClick={handleDownload} disabled={downloading}>
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
      </div>

      {error && <div className="section-panel text-rose-400">{error}</div>}

      {loading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <span>AI is generating your resume…</span>
        </div>
      )}

      {resume && (
        <div className="section-panel">
          <div className="flex justify-between items-center mb-4">
            <h3>Generated Resume</h3>
            <button className="btn btn-ghost text-xs" onClick={() => navigator.clipboard?.writeText(resume)}>
              Copy
            </button>
          </div>
          <div className="ai-text">{resume}</div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: Placement Assistant
   ═══════════════════════════════════════════════════════ */
function PlacementAssistantTab({ student }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! I’m your Placement Assistant. Ask me about placement rules, eligibility, applications, company requirements, or preparation.",
    },
  ]);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  useEffect(() => { getJobs().then(data => setJobs(Array.isArray(data) ? data : data.jobs || [])).catch(() => {}); }, []);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  const conversationRef = useRef(null);

  useEffect(() => {
    const container = conversationRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, loading]);

  const handleAsk = async (e) => {
    e?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setQuestion("");
    setLoading(true);

    try {
      const data = await askPlacementAssistant(student.student_id, trimmed, [], selectedJob);
      setMessages((prev) => [...prev, { role: "assistant", text: data.answer || "No answer was returned.", evidence: data.evidence || [], jobMatches: data.job_matches || [], grounded: data.grounded }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", text: `I couldn't answer that: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">Placement Assistant</h2>
      <div className="section-panel"><label htmlFor="assistant-job">Ask about a specific opportunity</label>
        <select id="assistant-job" className="select-input" value={selectedJob} onChange={event => setSelectedJob(event.target.value)} disabled={loading}><option value="">Campus policies & all jobs</option>{jobs.map(job => <option value={job.job_id} key={job.job_id}>{job.company_name} - {job.job_title}</option>)}</select>
        <div className="flex flex-wrap gap-2 mt-4">{["What are the campus placement rules?", "What are the selection rounds for this job?", "Find jobs matching my skills."].map(prompt => <button className="btn btn-ghost text-sm" key={prompt} disabled={loading} onClick={() => setQuestion(prompt)}>{prompt}</button>)}</div>
        <p className="text-sm text-slate-400 mt-3">Answers use published campus policies and job requirements. Expand the sources to inspect the exact retrieved passages.</p>
      </div>
      <div className="section-panel chat-panel">
        <div className="chat-header"><span className="brand-mark"><Icon name="assistant" /></span><div><h3>Your placement companion</h3><p>Guidance for your next step, all in one conversation.</p></div></div>
        <div ref={conversationRef} className="chat-messages" role="log" aria-label="Placement assistant conversation" aria-live="polite" aria-relevant="additions text">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`chat-message ${message.role === "user" ? "chat-message-user" : "chat-message-assistant"}`}
            >
              <p className="chat-author">{message.role === "user" ? "You" : "Placement Assistant"}</p>
              <div className="ai-text max-h-none">{message.text}</div>
              {message.evidence?.length > 0 && <div className="mt-4"><p className="text-sm font-semibold">Retrieved sources</p>{message.evidence.map((source, sourceIndex) => <details key={sourceIndex} className="section-panel mt-2"><summary>[{source.citation}] {source.title}{source.revision ? ` - version ${source.revision}` : ""}</summary><p className="text-sm text-slate-400">{source.kind === "campus" ? "Campus-wide policy" : source.kind === "student_document" ? "Your personal document" : `Job-specific source #${source.job_id}`}</p><div className="ai-text" style={{whiteSpace:"pre-wrap"}}>{source.excerpt}</div></details>)}</div>}
              {message.jobMatches?.length > 0 && <div className="mt-4"><h4>Related opportunities</h4>{message.jobMatches.map(job => <div key={job.job_id} className="section-panel mt-2"><strong>{job.company_name} - {job.job_title}</strong><p>{job.eligibility?.eligible ? "Your current profile meets the academic criteria." : "Your current profile does not meet all academic criteria."}</p><p className="text-sm text-slate-400">CGPA: {job.min_cgpa}+ | Max backlogs: {job.max_backlogs} | {job.eligible_branches}. Review any additional policy requirements before applying.</p><button className="btn btn-ghost mt-2" onClick={() => setSelectedJob(String(job.job_id))}>Ask about this job</button></div>)}</div>}
            </div>
          ))}
          {loading && <div className="chat-thinking" role="status">Assistant is thinking…</div>}
        </div>

        <form onSubmit={handleAsk} className="chat-composer">
          <input
            aria-label="Message the placement assistant"
            className="input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about placement rules, eligibility, or preparation…"
            disabled={loading}
          />
          <button className="btn btn-primary" type="submit" disabled={!question.trim() || loading}>
            Send message
          </button>
        </form>
        <p className="chat-disclaimer">Explore eligibility, applications, and interview preparation.</p>
      </div>
      <DocumentAssistant key={student.student_id} scope="student" studentId={student.student_id} title="Ask your documents" />
    </div>
  );
}

export default StudentDashboard;
