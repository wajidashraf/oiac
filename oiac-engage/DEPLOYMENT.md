# OIAC Engage Power Pages Deployment Guide

This is the maintained deployment runbook for the OIAC Engage React-based Power Pages code site. It records the Development and Test/UAT environments and provides the complete manual deployment procedure.

The Dataverse environment URL is an administration endpoint. It is not necessarily the public Power Pages website URL.

## Deployment safety rules

- Confirm the active tenant, environment, organization, user, and website immediately before every upload.
- Always use `pac pages upload-code-site`. Never use `pac pages upload` for this project; that command targets portal-studio sites and can corrupt code-site metadata.
- Never commit passwords, device codes, access tokens, client secrets, certificates, or PAC authentication caches.
- Do not change an environment-wide setting such as `blockedattachments` without explicit administrator approval.
- Treat activation and cache restart as separate operations. A restart can cause a few seconds of downtime.
- Never force-push deployment history to GitHub.

## Shared site configuration

| Property | Value |
|---|---|
| Site name | OIAC Engage |
| Website ID | `e7f400bd-1e04-4efa-b8b3-7a7a3b168662` |
| Deployment account | `developer@OIAC.org` |
| Tenant ID | `11189a88-b50a-4458-8fd8-3ae0e3019c23` |
| Cloud | Public |
| Project directory | `oiac-engage` |
| Project configuration | `powerpages.config.json` |
| Compiled output | `dist` |
| Default landing page | `index.html` |
| Default language ID | `af2a4e16-9e37-4a3c-91e3-500fda080d29` |
| Website language | `1033` (English) |
| Header web-template ID | `f3109259-7d0e-40db-846a-ccd7d80af54b` |
| Footer web-template ID | `c586193b-2ee3-4629-9376-40ae78ae78f2` |
| GitHub repository | `https://github.com/wajidashraf/oiac.git` |
| GitHub deployment branch | `main` |

The website ID is the same in Development and Test/UAT because the website component was moved between independent Dataverse environments while preserving its component GUID. The data and runtime configuration in those environments remain separate.

Both environments may list another website named **OIAC Engage - oiac-dev** with ID `5f20a359-84b5-43f6-a6b3-5131b309bccd`. That is not the target of this repository. The `.powerpages-site/.portalconfig/manifest.yml` file must continue targeting **OIAC Engage** with website ID `e7f400bd-1e04-4efa-b8b3-7a7a3b168662`.

## Environment inventory

### Development

| Property | Value |
|---|---|
| Environment name | OIAC Dev Environment |
| Dataverse URL | `https://org9b0fb7b2.crm.dynamics.com/` |
| Environment ID | `73f695f4-5b3c-e33d-969c-774bdc35841b` |
| Organization ID | `b84eadb5-e290-f111-b8ce-000d3a32090b` |
| Organization unique name | `unqb84eadb5e290f111b8ce000d3a320` |
| Tenant ID | `11189a88-b50a-4458-8fd8-3ae0e3019c23` |
| Deployment account | `developer@OIAC.org` |
| Website ID | `e7f400bd-1e04-4efa-b8b3-7a7a3b168662` |
| Environment manifest | `org9b0fb7b2.crm.dynamics.com-manifest.yml` |
| Known public portal | `https://oiac-engage.powerappsportals.com/` |

### Test/UAT

| Property | Value |
|---|---|
| Environment name | Saeed Shams's Environment |
| Dataverse URL | `https://org97063a46.crm.dynamics.com/` |
| Environment ID | `16838866-275a-e2e7-838f-57313f30a416` |
| Organization ID | `3f613eb3-72ea-f011-aa23-6045bd003f09` |
| Organization unique name | `unq3f613eb372eaf011aa236045bd003` |
| Tenant ID | `11189a88-b50a-4458-8fd8-3ae0e3019c23` |
| Deployment account | `developer@OIAC.org` |
| Website ID | `e7f400bd-1e04-4efa-b8b3-7a7a3b168662` |
| Environment manifest | `org97063a46.crm.dynamics.com-manifest.yml` |
| Public portal | Confirm from **Power Pages > Site details** in the Test/UAT environment before runtime testing. |

## Web roles

| Role | ID | Default role |
|---|---|---|
| Administrators | `6ec72c3e-4f1b-420f-9565-d20047b12c1f` | No |
| Anonymous Users | `0a919c57-3065-4cd3-aaa8-aec59acbbe67` | Anonymous users |
| Authenticated Users | `0353acdd-7b95-4c07-8997-ae95dafd978d` | Authenticated users |
| Volunteer | `b743c85b-4db3-484a-bd49-ff5ff975ec2b` | No |
| Staff | `89a4fe62-4c85-48cb-b848-7603374faca2` | No |
| Applicant | `c0ff381c-44a5-497b-b738-a442d62b07c1` | No |

Role definitions alone do not enforce access. Contacts must be assigned to the appropriate web roles, and page/table permissions must reference those roles.

## Recent deployment records

### Test/UAT deployment — 31 August 2026 UTC

- Target: Saeed Shams's Environment.
- Production build: successful.
- Compiled bundles:
  - `index-DYGkLvVC.css`
  - `index-Bi8kxI7L.js`
- PAC processed 216 records across 48 entities.
- Upload events: 55/55 completed.
- Upload duration: 136.82 seconds.
- Result: `Power Pages website upload succeeded`.
- Deployment-artifact commit: `5d72ba9` (`chore: deploy site to test Power Pages`).
- Activation and cache restart were not performed.

### Development deployment — 1 September 2026 Asia/Riyadh

- Target: OIAC Dev Environment.
- Production build: successful.
- Compiled bundles:
  - `index-DYGkLvVC.css`
  - `index-Bi8kxI7L.js`
- PAC processed 223 records across 48 entities.
- Upload events: 55/55 completed.
- Upload duration: 123.31 seconds.
- Result: `Power Pages website upload succeeded`.
- Deployment-tracking commit: `f86845f` (`chore: record OIAC dev deployment`).
- No JavaScript attachment block was encountered.
- Cache restart was not performed.

## Manual deployment procedure

Run these commands from PowerShell. Replace the local paths only if the repository is stored somewhere else.

### 1. Set the repository paths

```powershell
$repositoryRoot = 'C:\Users\Administrator\Videos\PersonalPics\OAIC'
$projectRoot = Join-Path $repositoryRoot 'oiac-engage'
Set-Location $projectRoot
```

The project root is the directory containing `powerpages.config.json`.

### 2. Verify prerequisites

```powershell
node --version
npm --version
pac help
git --version
```

If PAC CLI is unavailable and the .NET SDK is installed:

```powershell
dotnet tool install --global Microsoft.PowerApps.CLI.Tool
```

### 3. Review the repository before deployment

```powershell
Set-Location $repositoryRoot
git status --short
git diff --check
git log -1 --oneline
Set-Location $projectRoot
```

Resolve unexpected tracked changes before deploying. Do not stage unrelated directories such as `Minimal Volunteer Portal Design.make`.

### 4. Authenticate with PAC CLI

Review stored authentication profiles:

```powershell
pac auth list
pac auth who
```

If an OIAC authentication profile does not exist, create one for the intended environment. Browser authentication is the normal option.

For **Development**:

```powershell
pac auth create --environment 'https://org9b0fb7b2.crm.dynamics.com/' --name 'OIAC-Dev'
```

For **Test/UAT**:

```powershell
pac auth create --environment 'https://org97063a46.crm.dynamics.com/' --name 'OIAC-Test'
```

If the browser callback times out, use Microsoft's device-code flow with the intended URL. This example targets Development:

```powershell
pac auth create --environment 'https://org9b0fb7b2.crm.dynamics.com/' --name 'OIAC-Dev' --deviceCode
```

PAC prints a Microsoft device-login URL and a temporary code. Open the URL, enter the code, and sign in as an authorized OIAC deployment account. Never put the temporary code in source control.

PAC can initially attach a new profile to the tenant's default environment instead of the requested environment. This does not authorize an upload. Always continue with explicit environment selection.

### 5. Select exactly one target environment

List the environments available to the authenticated account:

```powershell
pac org list
```

For **Development**:

```powershell
$targetEnvironmentName = 'OIAC Dev Environment'
$targetEnvironmentUrl = 'https://org9b0fb7b2.crm.dynamics.com/'
$targetEnvironmentId = '73f695f4-5b3c-e33d-969c-774bdc35841b'
$targetOrganizationId = 'b84eadb5-e290-f111-b8ce-000d3a32090b'
$targetManifest = 'org9b0fb7b2.crm.dynamics.com-manifest.yml'
pac org select --environment $targetEnvironmentUrl
```

For **Test/UAT**:

```powershell
$targetEnvironmentName = "Saeed Shams's Environment"
$targetEnvironmentUrl = 'https://org97063a46.crm.dynamics.com/'
$targetEnvironmentId = '16838866-275a-e2e7-838f-57313f30a416'
$targetOrganizationId = '3f613eb3-72ea-f011-aa23-6045bd003f09'
$targetManifest = 'org97063a46.crm.dynamics.com-manifest.yml'
pac org select --environment $targetEnvironmentUrl
```

Run only the block for the environment being deployed.

### 6. Verify the active connection

```powershell
pac auth who
```

Compare the output with the selected environment inventory. It must show:

- Tenant ID: `11189a88-b50a-4458-8fd8-3ae0e3019c23`.
- User: `developer@OIAC.org`, or another explicitly authorized OIAC deployment account.
- Environment name, Environment ID, Organization ID, and unique name matching the intended target.

Stop immediately when any value differs. Do not assume that successful authentication means the correct environment is selected.

### 7. Verify the Power Pages website record

```powershell
pac pages list
```

Confirm the selected environment lists:

```text
Website ID: e7f400bd-1e04-4efa-b8b3-7a7a3b168662
Friendly Name: OIAC Engage
```

Do not deploy this repository to **OIAC Engage - oiac-dev** (`5f20a359-84b5-43f6-a6b3-5131b309bccd`).

### 8. Install dependencies

Use the lock file for a repeatable installation:

```powershell
Set-Location $projectRoot
npm ci
```

### 9. Run the complete test suite

```powershell
npm test -- --reporter=dot --silent
```

Expected result: every test file and test passes. Do not deploy when tests fail.

### 10. Build the production site

```powershell
npm run build
```

Expected result:

- TypeScript finishes without errors.
- Vite reports a successful production build.
- `dist/index.html` and hashed JavaScript/CSS bundles exist.

Confirm the site configuration when troubleshooting build output:

```powershell
Get-Content -Raw 'powerpages.config.json'
Get-ChildItem 'dist'
```

The expected configuration is:

```json
{
  "$schema": "https://www.schemastore.org/powerpages.config.json",
  "siteName": "OIAC Engage",
  "compiledPath": "dist",
  "defaultLandingPage": "index.html"
}
```

### 11. Optionally audit permissions

For redeployments that modify Web API access, table permissions, web roles, or site settings, run the project's Power Pages permission audit before uploading. Review critical and warning findings. Skipping an audit should be an explicit release decision, not an assumption.

### 12. Reconfirm and upload the code site

Run the connection check again immediately before the shared-environment write:

```powershell
pac auth who
pac pages upload-code-site --rootPath $projectRoot
```

The command may remove old hashed bundle directories before uploading the new build. This is expected. A successful run ends with output similar to:

```text
Uploading - [####################] 100.0%
Power Pages website upload succeeded
Connected to... OIAC Dev Environment
# or: Connected to... Saeed Shams's Environment
Upload complete
```

If the environment shown at the end is not the intended target, stop and investigate before performing any additional deployment.

### 13. Verify generated deployment metadata

```powershell
Get-ChildItem '.powerpages-site\web-files'
Get-ChildItem '.powerpages-site\web-roles' -Filter '*.webrole.yml'
Get-ChildItem '.powerpages-site\table-permissions' -Filter '*.tablepermission.yml'
Get-ChildItem '.powerpages-site\site-settings' -Filter '*.sitesetting.yml'
Get-ChildItem '.powerpages-site\.portalconfig'
Test-Path (Join-Path '.powerpages-site\.portalconfig' $targetManifest)
```

The final command must return `True` for the selected environment's manifest.

### 14. Commit PAC-generated deployment artifacts

Source changes should already be reviewed and committed before deployment. After upload, PAC may update compiled web files, the generic manifest, or an environment-specific manifest.

From the repository root:

```powershell
Set-Location $repositoryRoot
git status --short
git diff --check
git diff -- 'oiac-engage/.powerpages-site'
```

Stage only the expected generated site metadata:

```powershell
git add -- 'oiac-engage/.powerpages-site'
git diff --cached --stat
git commit -m 'chore: record Power Pages deployment'
```

If PAC did not change tracked metadata, no deployment-artifact commit is necessary. Never use a broad staging command when unrelated files are present.

### 15. Push safely to GitHub `main`

Verify the remote and fetch its current state:

```powershell
git remote -v
git fetch origin
git ls-remote --symref origin HEAD refs/heads/main
```

Confirm the remote is `https://github.com/wajidashraf/oiac.git` and its default branch is `main`.

Require a normal fast-forward before pushing:

```powershell
git merge-base --is-ancestor origin/main HEAD
if ($LASTEXITCODE -ne 0) {
    throw 'origin/main is not an ancestor of HEAD. Stop and review remote changes; do not force-push.'
}

git push origin HEAD:main
```

Never add `--force`. If Git rejects the push, fetch and inspect the remote commits before deciding how to integrate them.

Verify the published revision:

```powershell
$remoteMain = (git ls-remote origin refs/heads/main).Split("`t")[0]
$localHead = git rev-parse HEAD
$remoteMain
$localHead
if ($remoteMain -ne $localHead) {
    throw 'GitHub main does not match the local deployment revision.'
}
```

### 16. Perform post-deployment checks

1. Open the deployed public portal in a private browser session.
2. Verify anonymous landing and authentication pages.
3. Sign in with representative Administrator, Volunteer, Staff, and pending-approval accounts.
4. Verify Contacts, Meeting Reports, Events, Event Registration, My Calendar, Home KPIs, and the user profile Web API flow.
5. Check browser Network responses for unexpected `401`, `403`, or Power Pages error codes.
6. Confirm contacts have the intended custom web roles.

Activation and cache restart are separate actions:

- Activate/provision only when the site has no public URL and the desired subdomain has been approved.
- Restart the site only with explicit approval because it may cause brief downtime.
- If no restart is performed, allow the normal Power Pages cache TTL to expire.

## Troubleshooting

### Browser authentication times out

Use device-code authentication:

```powershell
pac auth create --environment $targetEnvironmentUrl --name 'OIAC-Deployment' --deviceCode
```

Complete the Microsoft device login, then run `pac org list`, `pac org select --environment $targetEnvironmentUrl`, and `pac auth who`.

### PAC selects the tenant default environment

Authentication can succeed while PAC remains connected to a tenant default organization. Do not upload. Select and verify the intended environment explicitly:

```powershell
pac org list
pac org select --environment $targetEnvironmentUrl
pac auth who
```

### The wrong authentication profile is active

```powershell
pac auth list
$profileIndex = 8 # Replace 8 with the index shown for the intended OIAC profile.
pac auth select --index $profileIndex
pac org select --environment $targetEnvironmentUrl
pac auth who
```

Never copy a profile index from another machine because profile ordering is local.

### JavaScript attachments are blocked

If upload reports that `.js` attachments are blocked, stop before changing settings. The `blockedattachments` setting affects the entire environment.

Inspect it with:

```powershell
pac env list-settings
```

Only an authorized environment administrator may approve removing `js` from the blocked extension list. After the approved change, rerun `pac pages upload-code-site`.

### Misleading HTML attachment error

An error claiming that `.html` attachments are blocked can be caused by a stale environment-specific manifest. Do not unblock HTML.

Preserve the stale manifest by renaming it, then retry so PAC creates a fresh one:

```powershell
$manifestPath = Join-Path '.powerpages-site\.portalconfig' $targetManifest
$backupName = "$targetManifest.bak"
Rename-Item -LiteralPath $manifestPath -NewName $backupName
pac pages upload-code-site --rootPath $projectRoot
```

Verify the replacement manifest and successful upload before deleting the `.bak` file.

### Association error `90040106`

This error means the signed-in web role lacks the table-permission privileges required to bind two records. Review both ends of the lookup relationship:

- The row containing the lookup needs the appropriate Append/Append To privilege.
- The lookup target needs the complementary association privilege.
- Both table permissions must be assigned to a web role held by the signed-in Contact.

Fix the Power Pages table permissions and role associations; changing only the SPA payload does not bypass Dataverse authorization.

### Build succeeds but changes are not visible

1. Confirm the upload ended successfully and named the intended environment.
2. Verify the deployed hashed bundle names match the current `dist/assets` output.
3. Use a private browser window to avoid browser cache.
4. If the site is activated, request approval to restart it and clear the runtime cache.

### GitHub push is rejected

Do not force-push. Fetch and inspect the divergence:

```powershell
git fetch origin
git log --oneline --left-right origin/main...HEAD
```

Integrate legitimate remote changes, rerun verification, and then perform a normal push.

## Security and maintenance notes

- The SPA's role-based visibility is not a security boundary; enforce access through Power Pages web roles and table/page permissions.
- A Volunteer `$filter` limits what the UI requests but does not override a Global Read table permission.
- Keep the environment inventory synchronized when URLs, IDs, site names, or deployment accounts change.
- Record each meaningful deployment with its target, result, relevant bundle names, and commit.
- Audit permissions after changes to Web API tables, lookup associations, or role assignments.
- Keep environment-specific manifests under `.powerpages-site/.portalconfig`; they allow PAC to map local records to the correct Dataverse environment.
