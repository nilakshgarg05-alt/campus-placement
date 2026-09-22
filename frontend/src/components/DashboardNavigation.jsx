import { useState } from "react";
import { logout } from "../api";
import { Link } from "react-router-dom";

export function Icon({ name = "overview", size = 20 }) {
  const paths = {
    overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    jobs: "M3 7h18v14H3z M8 7V3h8v4 M3 12h18 M10 12v3h4v-3",
    post: "M12 5v14 M5 12h14",
    applications: "M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h5",
    students: "m2 8 10-5 10 5-10 5z M6 10v7q6 5 12 0v-7 M22 8v8",
    companies: "M4 21V3h12v18 M16 9h4v12 M8 7h4 M8 11h4 M8 15h4 M9 21v-3h2v3",
    matches: "M20 12a8 8 0 1 1-8-8 M16 3h5v5 M21 3l-9 9 M15 12a3 3 0 1 1-3-3",
    assistant: "M21 11a8 8 0 0 1-8 8H8l-5 3V11a9 9 0 0 1 18 0Z M7 10h10 M7 14h6",
    resume: "M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h5",
    preparation: "M12 5v16 M12 5Q7 2 2 5v14q5-3 10 2 5-5 10-2V5q-5-3-10 0",
    interview: "M12 3v3 M5 6h14v14H5z M8 11h1 M15 11h1 M9 16h6 M2 10v6 M22 10v6",
    documents: "M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h7",
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name === "builder" ? "resume" : name] || paths.matches} /></svg>;
}

export function Brand() {
  return <Link to="/" className="brand"><span className="brand-mark"><Icon name="students" size={25} /></span><span>Campus Placement<span className="brand-caption">CAREERS, CONNECTED.</span></span></Link>;
}

export default function DashboardNavigation({ role, tabs, activeTab, onTabChange, children }) {
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  async function signOut() {
    setSigningOut(true); setLogoutError("");
    try { await logout(); } catch (err) { setLogoutError(err.message); }
    finally { setSigningOut(false); }
  }
  const descriptions = {
    Student: "Your next chapter starts here.",
    Recruiter: "Discover potential. Build your team.",
    "TPO / Admin": "Connect talent with opportunity.",
  };
  const label = (tab) => tab.label.replace(/^[^\p{L}]+/u, "");
  return <>
    <a className="skip-link" href="#dashboard-content">Skip to content</a>
    <aside className="dashboard-sidebar">
      <Brand />
      <div className="workspace-label">{role} workspace</div>
      <nav className="sidebar-nav" aria-label={`${role} sections`}>
        {tabs.map((tab) => <button key={tab.id} type="button" className={`nav-item ${activeTab === tab.id ? "active" : ""}`} aria-current={activeTab === tab.id ? "page" : undefined} onClick={() => onTabChange(tab.id)}><Icon name={tab.id} /><span>{label(tab)}</span>{activeTab === tab.id && <span className="nav-dot" />}</button>)}
      </nav>
      <div className="sidebar-note"><span className="eyebrow">MADE FOR YOUR NEXT MOVE</span><p>{descriptions[role]}</p><span>One connected placement experience.</span></div>
      <Link to="/" className="workspace-back">← Switch workspace</Link>
    </aside>
    <header className="dashboard-header">
      <div><p className="breadcrumb">Workspace <span>/</span> {role}</p><h1>{label(tabs.find((tab) => tab.id === activeTab) || tabs[0])}</h1></div>
      <div className="header-actions">{children}<button className="btn btn-ghost" onClick={signOut} disabled={signingOut}>{signingOut ? "Signing out..." : "Sign out"}</button>{logoutError && <span role="alert" className="text-rose-400">{logoutError}</span>}<span className="workspace-badge"><span /> {role} portal</span></div>
    </header>
  </>;
}
