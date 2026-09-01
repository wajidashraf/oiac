# OIAC Engage Deployment Runbook Update Design

**Date:** 1 September 2026  
**Status:** Approved

## Objective

Update the existing root `DEPLOYMENT.md` so it is the single maintained reference for OIAC Engage Power Pages deployments. The guide must document both the development and test/UAT environments, explain the normal deployment workflow, and provide complete PowerShell commands for a manual deployment.

## Documentation Structure

The runbook will contain:

1. A short purpose and safety statement.
2. An environment inventory with separate Dev and Test/UAT sections.
3. Shared site metadata and a note explaining that identical component GUIDs can exist in separate Dataverse environments.
4. Recent deployment records for Dev and Test/UAT.
5. A numbered manual deployment procedure covering prerequisites, authentication, target selection, verification, dependency installation, tests, production build, code-site upload, metadata review, commit, and GitHub push.
6. Target-specific command examples for selecting Dev or Test/UAT.
7. Troubleshooting for browser authentication timeouts, device-code authentication, accidental selection of the tenant default environment, blocked JavaScript attachments, stale manifests, and delayed cache refresh.
8. Security and operational safeguards.

The existing `DEPLOYMENT.md` will be updated instead of creating a second operator guide.

## Environment Inventory

### Development

- Name: OIAC Dev Environment
- Dataverse URL: `https://org9b0fb7b2.crm.dynamics.com/`
- Environment ID: `73f695f4-5b3c-e33d-969c-774bdc35841b`
- Organization ID: `b84eadb5-e290-f111-b8ce-000d3a32090b`
- Unique name: `unqb84eadb5e290f111b8ce000d3a320`
- Tenant ID: `11189a88-b50a-4458-8fd8-3ae0e3019c23`
- Deployment account: `developer@OIAC.org`
- Environment manifest: `org9b0fb7b2.crm.dynamics.com-manifest.yml`

### Test/UAT

- Name: Saeed Shams's Environment
- Dataverse URL: `https://org97063a46.crm.dynamics.com/`
- Environment ID: `16838866-275a-e2e7-838f-57313f30a416`
- Organization ID: `3f613eb3-72ea-f011-aa23-6045bd003f09`
- Unique name: `unq3f613eb372eaf011aa236045bd003`
- Tenant ID: `11189a88-b50a-4458-8fd8-3ae0e3019c23`
- Deployment account: `developer@OIAC.org`
- Environment manifest: `org97063a46.crm.dynamics.com-manifest.yml`

Both environments contain the OIAC Engage website record with ID `e7f400bd-1e04-4efa-b8b3-7a7a3b168662`.

## Manual Deployment Behavior

The guide will require operators to run `pac auth who` immediately before uploading and compare the displayed tenant, environment, organization, and user with the selected environment inventory. Operators must stop when any value differs.

The only supported upload command is:

```powershell
pac pages upload-code-site --rootPath $projectRoot
```

The guide will explicitly prohibit `pac pages upload`, which targets portal-studio sites rather than Power Pages code sites.

The manual process will keep activation and cache restart separate from upload because those operations change shared runtime state and can cause brief downtime.

## GitHub Delivery

After the runbook update is verified, the documentation will be committed without staging the unrelated `Minimal Volunteer Portal Design.make` directory. The local project history will be pushed to the repository's default `main` branch only after confirming that the update is a normal fast-forward. No force push will be used.

## Validation

Before committing and pushing:

- Scan the runbook for placeholder text and conflicting environment values.
- Verify every GUID and URL against the supplied environment records and recent PAC output.
- Verify all commands use valid PAC CLI syntax.
- Run `git diff --check`.
- Confirm `origin/main` is an ancestor of the local branch.
- Confirm the final Git working tree contains no unintended staged files.
