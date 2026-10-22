# Meeting Report access — 2026-10-22

On /report, Administrators can read and edit every Meeting Report. Other users retain read/edit access only to reports linked to their own Contact by mss_reportedby. Use the existing table, list, edit form, submission and update services. No schema change, new endpoint, plug-in or role.

The fresh Production backup shows only Authenticated Owned Meeting Report Manage, Contact scope via mss_meetingreport_Reportedby_contact. Preserve it and the owned attachment permission unchanged.

Add Meeting Reports Administrators Manage, Global scope assigned exclusively to site Administrators (6ec72c3e-4f1b-420f-9565-d20047b12c1f): Read, Write, Append and Append To; no Global Create or Delete. Append privileges support existing Representative, District, Staff and Volunteer updates. Existing Contact-scoped create remains unchanged. Add an administrator-only Parent-scoped attachment metadata Read permission under the new report permission, with every attachment write privilege false, so the existing edit form can list attachments. Preserve storage, file flow and API field allowlists.

The existing unfiltered list API returns all server-permitted rows; Power Pages table permissions enforce access beyond client UI. Include the existing Reported By lookup in list summaries. Pass actual role and Contact ID from App, display Edit for Administrators or the matching owner (including legacy reports for Administrators), and reuse /report/:reportId/edit. Existing update payload excludes Reported By, preserving the original reporter. Do not add delete actions or change form workflow.

Explicitly scope Home's reused report list/count to its current Contact to preserve personal dashboard behavior; if Contact is absent, skip these requests. No Home layout or other dashboard requests change. Validate optional reporter GUID filters and retain filters over server continuations.

Verification: configuration exclusivity, owner permission preservation, admin Edit links for other-user and legacy reports, existing form update workflow, no reporter reassignment, list pagination, Home isolation, full frontend suite and build. Hosted Administrator and ordinary-user read/write denial checks require deployment and real test sessions. Local tests alone do not prove live permissions. This turn prepares the change locally; Production remains unchanged.

Reference: https://learn.microsoft.com/en-us/power-pages/security/table-permissions
