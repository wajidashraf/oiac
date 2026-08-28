# OIAC Engage Deployment Guide

This document records the current Power Pages deployment and provides a repeatable manual deployment procedure for the OIAC Engage code site.

## Current target

| Property | Value |
|---|---|
| Site name | OIAC Engage |
| Project directory | `oiac-engage` |
| Environment | OIAC Dev Environment |
| Environment URL | `https://org9b0fb7b2.crm.dynamics.com/` |
| Environment ID | `73f695f4-5b3c-e33d-969c-774bdc35841b` |
| Organization ID | `b84eadb5-e290-f111-b8ce-000d3a32090b` |
| Organization unique name | `unqb84eadb5e290f111b8ce000d3a320` |
| Tenant ID | `11189a88-b50a-4458-8fd8-3ae0e3019c23` |
| Cloud | Public |
| Deployment account | `developer@OIAC.org` |
| Website ID | `e7f400bd-1e04-4efa-b8b3-7a7a3b168662` |
| Default language ID | `af2a4e16-9e37-4a3c-91e3-500fda080d29` |
| Website language | `1033` (English) |
| Header web-template ID | `f3109259-7d0e-40db-846a-ccd7d80af54b` |
| Footer web-template ID | `c586193b-2ee3-4629-9376-40ae78ae78f2` |
| Compiled output | `dist` |
| Landing page | `index.html` |

The environment URL is a Dataverse administration URL, not necessarily the public Power Pages website URL.

## Web roles

| Role | ID | Default role |
|---|---|---|
| Administrators | `6ec72c3e-4f1b-420f-9565-d20047b12c1f` | No |
| Anonymous Users | `0a919c57-3065-4cd3-aaa8-aec59acbbe67` | Anonymous users |
| Authenticated Users | `0353acdd-7b95-4c07-8997-ae95dafd978d` | Authenticated users |
| Volunteer | `b743c85b-4db3-484a-bd49-ff5ff975ec2b` | No |
| Staff | `89a4fe62-4c85-48cb-b848-7603374faca2` | No |
| Applicant | `c0ff381c-44a5-497b-b738-a442d62b07c1` | No |

Role definitions alone do not enforce access. Contacts must be assigned to the appropriate roles, and page/table permissions must reference those roles.

## Deployment record: 24 August 2026

- PAC CLI version: `2.9.3+ga17df1d`
- Target confirmed as OIAC Dev Environment.
- Permissions audit skipped by user request.
- Production build completed successfully.
- PAC processed 136 records across 48 entity groups.
- Upload completed successfully in 125.83 seconds.
- Previous bundles removed:
  - `index-C_PYSTTB.css`
  - `index-oOVJ3-6p.js`
- Deployed bundles:
  - `index-DskKU0rJ.css`
  - `index-BBHMVZQE.js`
- Deployment commit: `cbd5a14661d41c2bd8d7d909af09d2b9df84f068`
- Commit message: `Deploy site to Power Pages`
- Activation and site restart were not performed.
- Activation-status automation could not run because an Azure CLI token was unavailable.

## Manual deployment

Run the following commands from PowerShell.

### 1. Open the project

```powershell
Set-Location 'C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage'
```

If the repository is copied elsewhere, replace this path with the directory containing `powerpages.config.json`.

### 2. Verify prerequisites

Install Node.js, npm, and Microsoft Power Platform CLI before continuing.

```powershell
node --version
npm --version
pac help
```

If PAC CLI is missing and the .NET SDK is installed:

```powershell
dotnet tool install --global Microsoft.PowerApps.CLI.Tool
```

### 3. Authenticate

Review available PAC profiles and the active connection:

```powershell
pac auth list
pac auth who
```

If an OIAC profile does not exist, create one:

```powershell
pac auth create --environment 'https://org9b0fb7b2.crm.dynamics.com/'
```

Select the target environment and verify it again:

```powershell
pac org select --environment 'https://org9b0fb7b2.crm.dynamics.com/'
pac auth who
```

Before uploading, confirm that the output shows:

- User: `developer@OIAC.org`, or another authorized OIAC deployment account.
- Environment: `OIAC Dev Environment`.
- Environment ID: `73f695f4-5b3c-e33d-969c-774bdc35841b`.

Stop if any of these values identify a different tenant or environment.

### 4. Install dependencies

Use `npm ci` for a clean, repeatable installation from `package-lock.json`:

```powershell
npm ci
```

### 5. Run tests

```powershell
npm test -- --no-file-parallelism --maxWorkers=1
```

Expected result: all test files and tests pass. Do not deploy a failing build.

### 6. Build the site

```powershell
npm run build
```

Expected result:

- TypeScript finishes without errors.
- Vite reports a successful production build.
- The generated files appear under `dist`.

### 7. Confirm the project configuration

`powerpages.config.json` must identify the compiled folder and landing page:

```json
{
  "$schema": "https://www.schemastore.org/powerpages.config.json",
  "siteName": "OIAC Engage",
  "compiledPath": "dist",
  "defaultLandingPage": "index.html"
}
```

### 8. Upload the code site

```powershell
pac pages upload-code-site --rootPath 'C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage'
```

Always use `pac pages upload-code-site` for this project. Do not use `pac pages upload`; that command is for portal-studio sites and can corrupt code-site metadata.

The command may remove previous hashed bundles before uploading the new build. This is expected. A successful run ends with messages similar to:

```text
Power Pages website upload succeeded
Connected to... OIAC Dev Environment
Upload complete
```

### 9. Verify local deployment metadata

Confirm that these locations exist:

```powershell
Get-ChildItem '.powerpages-site\web-files'
Get-ChildItem '.powerpages-site\web-roles' -Filter '*.webrole.yml'
Get-ChildItem '.powerpages-site\.portalconfig'
```

There should be six `*.webrole.yml` files and an environment manifest named:

```text
org9b0fb7b2.crm.dynamics.com-manifest.yml
```

### 10. Commit the deployment artifacts

From the repository root, review the changes before staging them:

```powershell
Set-Location 'C:\Users\Administrator\Videos\PersonalPics\OAIC'
git status --short
git diff --check
```

Stage only the application and intended documentation. Do not stage unrelated files:

```powershell
git add -- 'oiac-engage' 'docs'
git commit -m 'Deploy site to Power Pages'
```

### 11. Post-deployment actions

These actions are separate from uploading and require an explicit operational decision:

1. Activate/provision the site if it does not yet have a public URL.
2. Restart or clear the site cache if the deployed UI is not immediately visible. This can cause a few seconds of downtime.
3. Assign contacts to Volunteer, Staff, or Applicant roles.
4. Configure and audit page permissions and Dataverse table permissions.
5. Smoke-test every public route in the deployed site.

## Troubleshooting

### JavaScript attachments are blocked

If the upload reports that `.js` attachments are blocked, stop before changing settings. The `blockedattachments` setting applies to the environment, not only this site. An environment administrator must explicitly approve removing `js` from that list.

Inspect the setting with:

```powershell
pac env list-settings
```

After an authorized administrator changes the setting, rerun `pac pages upload-code-site`.

### Misleading HTML attachment error

An error claiming that `.html` attachments are blocked can be caused by a stale environment manifest. Do not unblock HTML. Preserve the current manifest by renaming it, then retry the upload:

```powershell
Rename-Item -LiteralPath '.powerpages-site\.portalconfig\org9b0fb7b2.crm.dynamics.com-manifest.yml' -NewName 'org9b0fb7b2.crm.dynamics.com-manifest.yml.bak'
pac pages upload-code-site --rootPath 'C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage'
```

Only remove the backup after the replacement upload succeeds and the new manifest is verified.

### Wrong environment is active

Do not upload. Select the intended environment and verify it:

```powershell
pac org select --environment 'https://org9b0fb7b2.crm.dynamics.com/'
pac auth who
```

### Build succeeds but changes are not visible

Confirm the upload succeeded. If the site is activated, clear or restart the Power Pages site from the Power Platform admin tools, understanding that this may cause brief downtime.

## Security notes

- Never commit passwords, client secrets, access tokens, or PAC authentication caches.
- Confirm the environment before every upload.
- Do not change environment-wide blocked attachment settings without approval.
- Do not treat client-side role cards as authorization; enforce access using Power Pages web roles and permissions.
- Keep environment-specific IDs in this file synchronized if the site is moved to another environment.
