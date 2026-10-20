# Appointments action

`AppointmentCommandPlugin.cs` is the only source compiled into the signed plug-in. It implements the unbound action `mss_AppointmentCommand`, using the integration caller's `context.UserId`; it never creates a SYSTEM service. It validates the trusted portal actor, enforces participant reads and recipient-only Pending transitions, and uses a conditional SDK `UpdateRequest` to prevent racing responses from overwriting each other.

The separate `RegisterAppointmentCommand.cs` is administrative tooling, not part of the deployed assembly. Its `Apply(IOrganizationService, dllPath, manifestPath)` method is called only by an authenticated UAT management helper after explicit authorization. It validates existing registration shape and solution membership before an update, rejects extra API parameters, creates missing approved components with `SolutionUniqueName=CRMSolution`, and verifies membership after creation. Plug-in types travel with the assembly; no generic table Create/Update steps are registered. API metadata is public to authenticated Dataverse API callers (`isprivate=false`), which is not an authorization control. Execution requires the existing `prvReadmss_Appointment` privilege. Portal users access only the fixed ServerLogic endpoint; their browser cannot provide ActorContactId.

## Build and test

On Windows with the official PAC CLI SDK assemblies and .NET Framework compiler installed, from the workspace root:

```powershell
& ./oiac-engage/backend/appointments/build-test.ps1
```

Use `-SdkDirectory` if the official PAC tools directory differs. The script compiles for .NET Framework 4.6.2, runs the executable SDK test harness, verifies the strong name and prints the SHA-256. It writes only to ignored `.superpowers/appointments-build/`. The signing key remains there and must be securely retained for future assembly updates; do not commit the private key. The test executable is not deployed. `Microsoft.Xrm.Sdk` is a platform reference, not an embedded dependency. No browser or application secret is needed to build.

## Registration contract

| Property | Value |
|---|---|
| Assembly | `Oiac.Engage.Appointments`, version `1.0.0.0`, Sandbox / Database |
| Type | `Oiac.Engage.Appointments.AppointmentCommandPlugin` |
| Action | `mss_AppointmentCommand`, unbound, POST, no custom processing steps |
| Required inputs | `ActorContactId` Guid (12), `Command` String (10), `Payload` String (10) |
| Output | `Result` String (10), JSON `{ok,...}` |
| Commands | incoming, outgoing, all, calendar, contacts, create, accept, reschedule |

Source protocol and role IDs are deliberately specific to the approved UAT website. Revalidate role/site IDs and privileges before promotion; do not run against Production. `scripts/appointments/action-registration.json` records the actual registered IDs/hash. The approved table changes are in `scripts/appointments/schema-manifest.json`; the lookup definition is documentation of the already-created UAT column, not an instruction to replay an unconditional POST. Promote schema/action with the solution after release approval.

The handler tests exercise privacy for A/B/C, functional-role creation/directory access, pending-recipient responses, actor stamping, field allowlists, actual option values, timezone gaps/folds, legacy null requester and conditional writes under a simulated race. They do not reproduce Dataverse transaction rollback behavior. A real conditional-write fault may emerge as a transaction error from the outer Custom API; the UI then preserves input and allows a retry, which rechecks current status/version before any write. Multi-user hosted UAT must verify this path; no unconditional fallback is permitted.

Authoritative Microsoft references: [custom API creation](https://learn.microsoft.com/power-apps/developer/data-platform/create-custom-api-with-code), [parameter types](https://learn.microsoft.com/power-apps/developer/data-platform/custom-api-tables), [plug-in registration](https://learn.microsoft.com/power-apps/developer/data-platform/register-plug-in), [optimistic concurrency](https://learn.microsoft.com/power-apps/developer/data-platform/optimistic-concurrency), [Power Pages server objects](https://learn.microsoft.com/power-pages/configure/server-objects).

The `all` read command requires the exact Administrator role and site membership on every page. Incoming/outgoing/calendar stay participant-scoped even for administrators. The UI exposes all reads through a separate administrator overview. The existing recipient-only Pending/version response contract is unchanged. Current SDK verification: 55 passing tests; see `docs/alm/appointment-views-uat-deployment.json` for actual deployed binary/read-back and hosted limits.
