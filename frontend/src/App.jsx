import SignupPortal from "./components/SignupPortal";
import AuthPortal from "./components/AuthPortal";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import StudentDashboard from "./components/StudentDashboard";
import RecruiterDashboard from "./components/RecruiterDashboard";
import TPODashboard from "./components/TPODashboard";
import { Brand, Icon } from "./components/DashboardNavigation";

function Home() {
  const roles = [
    { path: "student", icon: "students", number: "01", title: "For students", description: "Find your fit. Prepare with confidence. Take the next step in your career.", features: "Job discovery · Interview prep · Resume tools", action: "Explore student workspace" },
    { path: "recruiter", icon: "jobs", number: "02", title: "For recruiters", description: "Meet emerging talent and turn the right connections into great hires.", features: "Job postings · Skill matching · Applications", action: "Open recruiter workspace" },
    { path: "tpo", icon: "overview", number: "03", title: "For placement teams", description: "Bring your campus placement journey together with a clearer view of progress.", features: "Placement insights · Companies · Student tracking", action: "View placement workspace" },
  ];
  return <div className="landing-page">
    <header className="landing-header"><Brand /><a href="#workspaces" className="btn btn-ghost">Choose your workspace <span aria-hidden="true">↗</span></a></header>
    <main className="landing-main">
      <section className="landing-hero animate-fade-in-up">
        <div className="hero-copy"><span className="eyebrow hero-pill"><span /> YOUR CAMPUS. YOUR NEXT CHAPTER.</span><h1>Great potential.<br />Even greater<br /><span>possibilities.</span></h1><p>A connected space for students, recruiters, and placement teams. Discover opportunities and move from campus to career with confidence.</p><a href="#workspaces" className="btn btn-primary hero-cta">Find your workspace <span aria-hidden="true">↗</span></a><div className="hero-caption"><span className="small-line" /> Built for every step of your placement journey</div></div>
        <div className="career-visual" aria-label="Discover opportunities, prepare for interviews, and start your career">
          <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
          <div className="career-card"><div className="career-card-top"><span className="brand-mark"><Icon name="students" size={26} /></span><span className="badge badge-green">Your career journey</span></div><p className="eyebrow">FROM AMBITION TO OPPORTUNITY</p><h2>A brighter future,<br />one step at a time.</h2><div className="journey-step"><span>01</span><div><strong>Discover your fit</strong><p>Explore roles that match your skills</p></div><Icon name="jobs" /></div><div className="journey-step"><span>02</span><div><strong>Build your confidence</strong><p>Practice, prepare, and grow</p></div><Icon name="preparation" /></div><div className="journey-step"><span>03</span><div><strong>Make your next move</strong><p>Connect with your next opportunity</p></div><Icon name="matches" /></div></div>
          <div className="floating-note"><span className="sparkle">✦</span><div><strong>A little guidance. A big step forward.</strong><p>AI-powered preparation, built around you.</p></div></div>
        </div>
      </section>
      <section id="workspaces" className="workspaces-section"><div className="workspace-heading"><div><span className="eyebrow">ONE PLATFORM. SHARED POSSIBILITIES.</span><h2>Where would you like to start?</h2></div><p>Your tools, together in one workspace.</p></div><div className="home-role-grid stagger">{roles.map((role) => <Link key={role.path} to={`/${role.path}`} className="glass-card role-card animate-fade-in-up"><div className="role-card-top"><span className="role-icon"><Icon name={role.icon} size={24} /></span><span className="role-number">{role.number}</span></div><h3>{role.title}</h3><p>{role.description}</p><span className="role-features">{role.features}</span><span className="role-action">{role.action}<span aria-hidden="true">↗</span></span></Link>)}</div></section>
    </main>
    <footer className="landing-footer"><span>Campus Placement AI <span className="footer-dot">/</span> Connecting talent with opportunity.</span><span>Powered by Microsoft Azure AI Foundry</span></footer>
  </div>;
}

export default function App() {
  return <BrowserRouter><Routes><Route path="/signup/:role" element={<SignupPortal />} /><Route path="/" element={<Home />} /><Route path="/student" element={<AuthPortal role="student"><StudentDashboard /></AuthPortal>} /><Route path="/recruiter" element={<AuthPortal role="recruiter"><RecruiterDashboard /></AuthPortal>} /><Route path="/tpo" element={<AuthPortal role="tpo"><TPODashboard /></AuthPortal>} /></Routes></BrowserRouter>;
}
