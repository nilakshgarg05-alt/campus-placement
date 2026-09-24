import { useState } from "react";
export default function ResumeMatches({ data, onTailor }) {
  const [showOthers, setShowOthers] = useState(false);
  if (!data) return null;
  const jobs = data.recommendations || [];
  return <section className="section-panel mt-4">
    <h3 className="text-xl font-bold mb-3">Where your resume fits</h3>
    <p className="text-slate-400 mb-4">{data.method}</p>
    {!jobs.length && <p className="mb-4">{data.has_resume ? "No posted jobs currently combine academic eligibility with a required skill mentioned in your resume. Explore gaps below." : "Analyze a PDF resume to get recommendations."}</p>}
    {jobs.map(job => <Match key={job.job_id} job={job} onTailor={onTailor} />)}
    {!!data.other_jobs?.length && <><button className="btn btn-ghost mt-4" onClick={() => setShowOthers(value => !value)} aria-expanded={showOthers}>{showOthers ? "Hide" : "Show"} other jobs and eligibility gaps ({data.other_jobs.length})</button>
      {showOthers && data.other_jobs.map(job => <Match key={job.job_id} job={job} onTailor={onTailor} />)}</>}
  </section>;
}
function Match({ job, onTailor }) {
  return <article className="section-panel mt-3">
    <h4 className="font-bold">{job.company_name} - {job.job_title}</h4>
    <p className="mt-2">{job.coverage == null ? "No required skills listed" : `${job.coverage}% required-skill keyword coverage`} | {job.eligible ? "Meets listed academic criteria" : "Academic criteria not met"}</p>
    <p className="mt-2">Found in resume: {job.matched_skills.join(", ") || "None"}</p>
    <p>Not found: {job.missing_skills.join(", ") || "None"}</p>
    {!!job.eligibility_blockers.length && <p className="text-amber-400 mt-2">{job.eligibility_blockers.join("; ")}</p>}
    {!!job.saved_skills_missing_from_resume.length && <p className="mt-2">Already in your saved profile but missing from this resume: {job.saved_skills_missing_from_resume.join(", ")}. Add supporting examples if accurate.</p>}
    {!!job.next_steps.length && <details className="mt-2"><summary>Improvement checklist</summary><ul className="mt-2">{job.next_steps.map(item => <li key={item}>{item}</li>)}</ul></details>}
    <button className="btn btn-primary mt-3" onClick={() => onTailor(job.job_id)}>Build a resume for this job</button>
  </article>;
}
