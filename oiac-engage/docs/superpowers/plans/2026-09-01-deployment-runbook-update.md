# OIAC Engage Deployment Runbook Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the existing root deployment guide with accurate Dev and Test/UAT inventories, current deployment records, complete manual Power Pages commands, and push the verified project history to GitHub `main`.

**Architecture:** Keep `DEPLOYMENT.md` as the single operator-facing runbook. Separate immutable environment identity from deployment history, then document one shared manual process with explicit target-selection commands and verification gates. Deliver the completed documentation through a normal fast-forward push to the repository's default `main` branch.

**Tech Stack:** Markdown, PowerShell, Microsoft Power Platform CLI (`pac`), Node.js/npm, Git, GitHub.

## Global Constraints

- Do not create a second deployment guide.
- Do not include passwords, tokens, client secrets, or PAC authentication caches.
- Use `pac pages upload-code-site`; never use `pac pages upload` for this code site.
- Require `pac auth who` verification before every upload.
- Keep activation and cache restart as separately approved shared-state operations.
- Do not stage or commit the unrelated `Minimal Volunteer Portal Design.make` directory.
- Push to `origin/main` only when `origin/main` is an ancestor of the local branch; never force-push.

---

### Task 1: Update the Operator Deployment Runbook

**Files:**
- Modify: `DEPLOYMENT.md`
- Reference: `docs/superpowers/specs/2026-09-01-deployment-runbook-update-design.md`

**Interfaces:**
- Consumes: The approved Dev and Test/UAT environment identities and recent PAC deployment evidence.
- Produces: One self-contained manual deployment runbook for developers and release operators.

- [ ] **Step 1: Replace the single-target section with an environment inventory**

Document both targets in separate tables:

```text
Dev: OIAC Dev Environment
URL: https://org9b0fb7b2.crm.dynamics.com/
Environment ID: 73f695f4-5b3c-e33d-969c-774bdc35841b
Organization ID: b84eadb5-e290-f111-b8ce-000d3a32090b
Unique name: unqb84eadb5e290f111b8ce000d3a320
Manifest: org9b0fb7b2.crm.dynamics.com-manifest.yml

Test/UAT: Saeed Shams's Environment
URL: https://org97063a46.crm.dynamics.com/
Environment ID: 16838866-275a-e2e7-838f-57313f30a416
Organization ID: 3f613eb3-72ea-f011-aa23-6045bd003f09
Unique name: unq3f613eb372eaf011aa236045bd003
Manifest: org97063a46.crm.dynamics.com-manifest.yml
```

Record the shared tenant `11189a88-b50a-4458-8fd8-3ae0e3019c23`, deployment account `developer@OIAC.org`, website ID `e7f400bd-1e04-4efa-b8b3-7a7a3b168662`, site name `OIAC Engage`, compiled path `dist`, and landing page `index.html`.

- [ ] **Step 2: Replace the outdated deployment record with current Dev and Test/UAT records**

Record that both recent uploads built successfully and completed 55/55 upload events. Include the Test/UAT upload duration `136.82 seconds` and commit `5d72ba9`, and the Dev upload duration `123.31 seconds` and deployment-tracking commit `f86845f`.

- [ ] **Step 3: Make authentication and target selection environment-specific**

Document these exact selection commands:

```powershell
pac org select --environment 'https://org9b0fb7b2.crm.dynamics.com/'
pac org select --environment 'https://org97063a46.crm.dynamics.com/'
```

Add the device-code fallback:

```powershell
pac auth create --environment 'https://org9b0fb7b2.crm.dynamics.com/' --name 'OIAC-Dev' --deviceCode
```

Explain that PAC may initially attach a new profile to the tenant default environment; operators must run `pac org list`, explicitly select the intended URL, and re-run `pac auth who`.

- [ ] **Step 4: Complete the manual build, upload, verification, commit, and push procedure**

Use a reusable project variable:

```powershell
$projectRoot = 'C:\Users\Administrator\Videos\PersonalPics\OAIC\oiac-engage'
$repositoryRoot = Split-Path $projectRoot -Parent
Set-Location $projectRoot
npm ci
npm test -- --reporter=dot
npm run build
pac pages list
pac pages upload-code-site --rootPath $projectRoot
```

Document targeted staging and the safe GitHub push:

```powershell
Set-Location $repositoryRoot
git add -- 'oiac-engage/.powerpages-site' 'oiac-engage/DEPLOYMENT.md'
git commit -m 'docs: update deployment environments and runbook'
git fetch origin
git merge-base --is-ancestor origin/main HEAD
git push origin HEAD:main
```

Explain that a nonzero ancestry check stops the push for investigation and that `--force` must not be used.

- [ ] **Step 5: Self-review the runbook**

Run:

```powershell
rg -n 'TBD|TODO|PLACEHOLDER' DEPLOYMENT.md
rg -n 'pac pages upload' DEPLOYMENT.md
git diff --check -- oiac-engage/DEPLOYMENT.md
```

Expected: no placeholder hits, every upload-command hit either uses `upload-code-site` or explicitly warns against `pac pages upload`, and no whitespace errors. Manually compare every environment URL and GUID with the approved specification.

- [ ] **Step 6: Commit the runbook**

```powershell
git add -- oiac-engage/DEPLOYMENT.md
git commit -m 'docs: update deployment environments and runbook'
```

Expected: only `DEPLOYMENT.md` is included in this commit.

---

### Task 2: Verify and Push the Project to GitHub

**Files:**
- Read: repository history and remote refs
- Modify: no source files

**Interfaces:**
- Consumes: The committed deployment guide and current local `master` history.
- Produces: The same history published to GitHub's default `main` branch.

- [ ] **Step 1: Fetch and verify the remote state**

```powershell
git fetch origin
git remote -v
git ls-remote --symref origin HEAD refs/heads/main
git merge-base --is-ancestor origin/main HEAD
```

Expected: `origin` is `https://github.com/wajidashraf/oiac.git`, the remote default is `refs/heads/main`, and the ancestry command exits `0`.

- [ ] **Step 2: Verify the final working tree and commits**

```powershell
git diff --check
git status --short
git log --oneline origin/main..HEAD
```

Expected: no tracked changes or whitespace errors remain. The only allowed untracked item is `Minimal Volunteer Portal Design.make`, which must not be staged.

- [ ] **Step 3: Push without force**

```powershell
git push origin HEAD:main
```

Expected: GitHub reports a successful update to `main`. If rejected, stop and inspect remote changes; do not retry with `--force`.

- [ ] **Step 4: Verify the published revision**

```powershell
git ls-remote origin refs/heads/main
git rev-parse HEAD
```

Expected: both commands return the same commit SHA.
