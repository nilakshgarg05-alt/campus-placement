export const studentExtraFields = [
  { name: "college", label: "College / university", required: true, maxLength: 200 },
  { name: "roll_number", label: "Roll / enrollment number", required: true, maxLength: 50 },
  { name: "graduation_year", label: "Graduation year", type: "number", required: true, min: 1950, max: 2100 },
  { name: "achievements", label: "Achievements & awards", multiline: true, placeholder: "Hackathons, academic awards, competitions, leadership...", maxLength: 5000 },
  { name: "projects", label: "Projects & experience", multiline: true, placeholder: "Describe your projects, technologies used, internships, and contributions.", maxLength: 5000 },
  { name: "certifications", label: "Certifications", multiline: true, placeholder: "Certification name, issuer, and year", maxLength: 5000 },
  { name: "linkedin", label: "LinkedIn URL", type: "url", maxLength: 500 },
  { name: "github", label: "GitHub URL", type: "url", maxLength: 500 },
  { name: "portfolio", label: "Portfolio URL", type: "url", maxLength: 500 },
];

