const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "https://campus-placement-api-hbe4bfe7dygna5hg.uaenorth-01.azurewebsites.net"
).replace(/\/$/, "");

export function getSessionToken() { return sessionStorage.getItem("campus-session"); }
export function clearSession(message = "") {
  sessionStorage.removeItem("campus-session");
  window.dispatchEvent(new CustomEvent("session-ended", { detail: message }));
}
function authHeaders() {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function errorMessage(data, status) {
  const detail = typeof data === "object" && data !== null ? data.detail || data.error || data.message : data;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(". ");
  return typeof detail === "string" ? detail : `Request failed (${status})`;
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    });
  } catch {
    throw new Error("Cannot connect to the placement server. Check that the backend is running and allows this website's address, then try again.");
  }

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok || data?.error) {
    if (res.status === 401 && path !== "/auth/login") clearSession();
    throw new Error(errorMessage(data, res.status));
  }

  return data;
}

export async function login(email, password) {
  const data = await request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  sessionStorage.setItem("campus-session", data.token);
  return data.account;
}
export function getAccount() { return request("/auth/me"); }
export async function logout() {
  await request("/auth/logout", { method: "POST" });
  clearSession();
}
export function getMyProfile() { return request("/students/me"); }
export function updateMyProfile(profile) {
  return request("/students/me", { method: "PUT", body: JSON.stringify(profile) });
}

export function getHealth() {
  return request("/health");
}

export function getStudents() {
  return request("/students");
}

export function getCompanies() {
  return request("/companies");
}

export function getJobs() {
  return request("/jobs");
}

export function checkEligibility(studentId, jobId) {
  return request(`/eligibility/${studentId}/${jobId}`);
}

export function applyForJob(studentId, jobId) {
  return request("/applications", {
    method: "POST",
    body: JSON.stringify({ student_id: studentId, job_id: jobId }),
  });
}

export function getStudentApplications(studentId) {
  return request(`/students/${studentId}/applications`);
}

export function updateApplicationStatus(applicationId, status) {
  return request(`/applications/${applicationId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export function getJobApplications(jobId) {
  return request(`/jobs/${jobId}/applications`);
}

export function getReadiness(studentId, jobId) {
  return request(`/readiness/${studentId}/${jobId}`);
}

export function getCompanyPreparation(studentId, jobId) {
  return request(`/company-preparation/${studentId}/${jobId}`);
}

export function startInterview(studentId, jobId) {
  return request("/interview/start", {
    method: "POST",
    body: JSON.stringify({ student_id: studentId, job_id: jobId }),
  });
}

export function answerInterview(interviewId, questionId, answer) {
  return request("/interview/answer", {
    method: "POST",
    body: JSON.stringify({
      interview_id: interviewId,
      question_id: questionId,
      answer,
    }),
  });
}

export function finishInterview(interviewId) {
  return request(`/interview/finish/${interviewId}`, { method: "POST" });
}

export async function analyzeResume(studentId, file) {
  const form = new FormData();
  form.append("file", file);
  return request(`/resume/analyze?student_id=${studentId}`, {
    method: "POST",
    body: form,
  });
}

export function getResumeRecommendations() { return request("/resume/recommendations"); }

export function generateResume(studentId, jobId = null) {
  return request("/resume/generate", {
    method: "POST",
    body: JSON.stringify({ student_id: studentId, job_id: jobId ? Number(jobId) : null }),
  });
}

export async function downloadResumePdf(studentId, jobId = null, resumeText = null) {
  const res = await fetch(`${BASE_URL}/resume/generate-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ student_id: studentId, job_id: jobId ? Number(jobId) : null, resume_text: resumeText }),
  });

  if (!res.ok || !(res.headers.get("content-type") || "").includes("application/pdf")) {
    if (res.status === 401) clearSession();
    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json() : await res.text();
    throw new Error(errorMessage(data, res.status));
  }

  return res.blob();
}

export function askPlacementAssistant(studentId, question, documentIds = [], jobId = null) {
  return request("/placement-assistant", {
    method: "POST",
    body: JSON.stringify({ student_id: studentId, question, document_ids: documentIds, job_id: jobId ? Number(jobId) : null }),
  });
}

export function uploadPlacementDocument(scope, file, studentId = null) {
  const form = new FormData();
  form.append("scope", scope);
  if (scope === "student" && studentId) form.append("student_id", String(studentId));
  form.append("file", file);
  return request("/documents/upload", { method: "POST", body: form });
}

export function getPlacementDocuments(scope, studentId = null) {
  const query = new URLSearchParams({ scope });
  if (scope === "student" && studentId) query.set("student_id", String(studentId));
  return request(`/documents?${query}`);
}

export function askDocumentAssistant(scope, question, documentIds, studentId = null) {
  return request("/document-assistant/query", {
    method: "POST",
    body: JSON.stringify({
      scope,
      question,
      document_ids: documentIds,
      ...(scope === "student" && studentId ? { student_id: studentId } : {}),
    }),
  });
}

export function createRecruiterJob(job) {
  return request("/recruiter/jobs", {
    method: "POST",
    body: JSON.stringify(job),
  });
}

export function getSkillMatches(jobId) {
  return request(`/jobs/${jobId}/matches`);
}

export function getAIRecruiterMatch(jobId) {
  return request(`/ai/recruiter-match/${jobId}`, { method: "POST" });
}

export function getEligibleStudents(jobId) {
  return request(`/jobs/${jobId}/eligible-students`);
}

export function getTPODashboard() {
  return request("/tpo/dashboard");
}

export function getTPOCompanyStats() {
  return request("/tpo/company-statistics");
}

export function getTPOJobStats() {
  return request("/tpo/job-statistics");
}

export function getTPOStudentStatus() {
  return request("/tpo/student-status");
}

export function signup(profile) {
  return request("/auth/signup", { method: "POST", body: JSON.stringify(profile) });
}

export function updateStaffProfile(profile) {
  return request("/auth/profile", {method: "PUT", body: JSON.stringify(profile)});
}
export async function correctAccountEmail(email, password) {
  const result = await request("/auth/email", {method: "PUT", body: JSON.stringify({email, password})});
  clearSession(result.message);
}
export function getTPOUploads() { return request("/tpo/documents"); }
function uploadPath(item, download = false) {
  const suffix = download ? "/download" : "";
  if (item.kind === "resume") return `/tpo/resumes/${encodeURIComponent(item.document_id)}${suffix}`;
  const query = new URLSearchParams({scope: item.scope});
  if (item.student_id) query.set("student_id", item.student_id);
  return `/tpo/documents/${encodeURIComponent(item.document_id)}${suffix}?${query}`;
}
export function previewTPOUpload(item) { return request(uploadPath(item)); }
export async function downloadTPOUpload(item) {
  const response = await fetch(`${BASE_URL}${uploadPath(item, true)}`, {headers: authHeaders()});
  if (!response.ok) {
    if (response.status === 401) clearSession();
    const data = await response.json();
    throw new Error(errorMessage(data, response.status));
  }
  return response.blob();
}

export function getCampusPolicies() { return request("/knowledge/policies"); }
export function publishCampusPolicy(policy) { return request("/knowledge/policies", {method:"POST",body:JSON.stringify(policy)}); }
export function reviseCampusPolicy(id, policy) { return request(`/knowledge/policies/${id}`, {method:"PUT",body:JSON.stringify(policy)}); }
export function archiveCampusPolicy(id) { return request(`/knowledge/policies/${id}`, {method:"DELETE"}); }
export function getJobKnowledge(id) { return request(`/knowledge/jobs/${id}`); }
export function uploadKnowledgeFile(kind, title, file) {
  const form = new FormData(); form.append("kind",kind); form.append("title",title); form.append("file",file);
  return request("/knowledge/files", {method:"POST",body:form});
}
