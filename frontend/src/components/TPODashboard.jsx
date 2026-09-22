import JobRequirements from "./JobRequirements";
import TPOUploads from "./TPOUploads";
import StaffProfile from "./StaffProfile";
import DashboardNavigation from "./DashboardNavigation";
import CampusPolicies from "./CampusPolicies";
import { useEffect, useState } from "react";
import {
  getTPODashboard,
  getTPOCompanyStats,
  getTPOJobStats,
  getTPOStudentStatus,
} from "../api";

/* ─── Main ─────────────────────────────────────────────── */
export default function TPODashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "policies", label: "Campus Policies" },
    { id: "uploads", label: "Student & Recruiter Uploads" },
    { id: "profile", label: "My Profile" },
    { id: "overview", label: "📊 Overview" },
    { id: "companies", label: "🏢 Companies" },
    { id: "jobs", label: "💼 Jobs" },
    { id: "students", label: "🎓 Students" },
  ];

  return (
    <div className="dashboard-shell tpo-theme">
      <DashboardNavigation role="TPO / Admin" tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>

      </DashboardNavigation>

      <main id="dashboard-content" tabIndex={-1} className="dashboard-main animate-fade-in">
        {activeTab === "uploads" && <TPOUploads />}
        {activeTab === "profile" && <StaffProfile />}
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "companies" && <CompaniesTab />}
        {activeTab === "jobs" && <JobsTab />}
        {activeTab === "students" && <StudentsTab />}
        {activeTab === "policies" && <CampusPolicies />}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: Overview
   ═══════════════════════════════════════════════════════ */
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTPODashboard()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-overlay"><div className="spinner" /><span>Loading dashboard…</span></div>;
  if (!stats) return <p className="text-rose-400">Failed to load dashboard data.</p>;

  const cards = [
    { label: "Total Students", value: stats.total_students, color: "blue", icon: "🎓" },
    { label: "Total Companies", value: stats.total_companies, color: "green", icon: "🏢" },
    { label: "Total Jobs", value: stats.total_jobs, color: "purple", icon: "💼" },
    { label: "Total Applications", value: stats.total_applications, color: "amber", icon: "📄" },
    { label: "Shortlisted", value: stats.shortlisted_students, color: "blue", icon: "⭐" },
    { label: "Placed", value: stats.placed_students, color: "green", icon: "🎉" },
  ];

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">Placement Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
        {cards.map((card) => (
          <div key={card.label} className={`stat-card ${card.color} animate-fade-in-up`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm">{card.label}</p>
                <p className="text-4xl font-extrabold mt-2 animate-count-up">{card.value}</p>
              </div>
              <span className="text-3xl opacity-60">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Placement Rate */}
      {stats.total_students > 0 && (
        <div className="section-panel mt-8 animate-fade-in-up">
          <h3 className="mb-3">Placement Rate</h3>
          <div className="flex items-center gap-4">
            <div className="progress-bar flex-1">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.round((stats.placed_students / stats.total_students) * 100)}%`,
                  background: "var(--gradient-green)",
                }}
              />
            </div>
            <span className="text-xl font-bold text-emerald-400">
              {Math.round((stats.placed_students / stats.total_students) * 100)}%
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-2">
            {stats.placed_students} out of {stats.total_students} students placed
          </p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: Companies
   ═══════════════════════════════════════════════════════ */
function CompaniesTab() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTPOCompanyStats()
      .then((data) => setCompanies(data.companies || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-overlay"><div className="spinner" /><span>Loading companies…</span></div>;

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">Company Statistics</h2>
      <div className="section-panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Total Jobs</th>
              <th>Applications</th>
              <th>Placed</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.company_id}>
                <td className="font-medium text-white">{c.company_name}</td>
                <td>{c.total_jobs}</td>
                <td>{c.total_applications}</td>
                <td>
                  <span className={`badge ${c.placed_students > 0 ? "badge-green" : "badge-rose"}`}>
                    {c.placed_students}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: Jobs
   ═══════════════════════════════════════════════════════ */
function JobsTab() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTPOJobStats()
      .then((data) => setJobs(data.jobs || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-overlay"><div className="spinner" /><span>Loading jobs…</span></div>;

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">Job Statistics</h2>
      <div className="section-panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Company</th>
              <th>Title</th>
              <th>Applications</th>
              <th>Shortlisted</th>
              <th>Placed</th><th>Requirement policies</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.job_id}>
                <td>{j.job_id}</td>
                <td className="font-medium text-white">{j.company_name}</td>
                <td>{j.job_title}</td>
                <td>{j.total_applications}</td>
                <td><span className="badge badge-amber">{j.shortlisted_students}</span></td>
                <td><span className={`badge ${j.placed_students > 0 ? "badge-green" : "badge-rose"}`}>{j.placed_students}</span></td><td><JobRequirements jobId={j.job_id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: Students
   ═══════════════════════════════════════════════════════ */
function StudentsTab() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTPOStudentStatus()
      .then((data) => setStudents(data.students || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-overlay"><div className="spinner" /><span>Loading students…</span></div>;

  return (
    <div className="animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-6">Student Placement Status</h2>
      <div className="section-panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Branch</th>
              <th>CGPA</th>
              <th>Applications</th>
              <th>Shortlisted</th>
              <th>Placed</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.student_id}>
                <td>{s.student_id}</td>
                <td className="font-medium text-white">{s.name}</td>
                <td>{s.email}</td>
                <td><span className="badge badge-purple">{s.branch}</span></td>
                <td>{s.cgpa}</td>
                <td>{s.total_applications}</td>
                <td><span className="badge badge-amber">{s.shortlisted}</span></td>
                <td>
                  <span className={`badge ${s.placed > 0 ? "badge-green" : "badge-rose"}`}>
                    {s.placed > 0 ? "✅ Placed" : "Pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
