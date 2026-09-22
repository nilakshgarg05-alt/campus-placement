-- Review and run in campusplacementdb only after approving application data access.
-- SQL SID uses client ID 1ba4953b-f4ec-4438-93f6-91801677cb69.
-- Identity: CampusPlacement (3d27faee-b115-490e-8007-441929a5eeca).
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'CampusPlacement')
    CREATE USER [CampusPlacement] WITH SID = 0x3b95a41becf4384493f691801677cb69, TYPE = E;
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[Applications] TO [CampusPlacement];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[Companies] TO [CampusPlacement];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[InterviewQuestions] TO [CampusPlacement];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[Interviews] TO [CampusPlacement];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[Jobs] TO [CampusPlacement];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[JobSkills] TO [CampusPlacement];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[PlacementKnowledge] TO [CampusPlacement];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[PortalAccounts] TO [CampusPlacement];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[PortalSessions] TO [CampusPlacement];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[PortalStaffDetails] TO [CampusPlacement];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[PortalStudentDetails] TO [CampusPlacement];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[Resumes] TO [CampusPlacement];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[StudentCertifications] TO [CampusPlacement];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[StudentProjects] TO [CampusPlacement];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[Students] TO [CampusPlacement];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[StudentSkills] TO [CampusPlacement];
