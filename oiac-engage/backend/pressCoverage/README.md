# Read-only coverage time adapter

`mss_CoverageLocalTime` accepts one required String `UtcTime` and returns String `LocalTime`. The separate Sandbox assembly `Oiac.Engage.CoverageTime` invokes the native Dataverse `LocalTimeFromUtcTimeRequest` with fixed business timezone **129 / Jordan Standard Time**, under `context.UserId`. It performs no business-record reads, writes or associations. It rejects non-UTC, malformed and pre-1753 inputs, and propagates native failures without a fixed-offset fallback.

The returned timestamp represents local wall-clock fields with a consistent `Z` marker for the existing JavaScript date-only conversion. It must not be treated as a newly converted UTC instant. The existing endpoint uses it to derive business dates and verify the inverse at local noon.

Hosted Power Pages `InvokeCustomApi` rejected the built-in function URI, including parameter aliases, before Dataverse execution. The fixed Custom API action works through the supported connector contract. The browser never chooses a timezone or arbitrary API URL; it uses the existing authenticated coverage endpoint. Direct coverage Web API remains disabled, and portal record permissions are unchanged.

Build and run the 16 SDK tests from the workspace root:

```powershell
& ./oiac-engage/backend/pressCoverage/build-test.ps1
```

The build and private signing key stay under ignored `.superpowers/coverage-time-build/`. `RegisterCoverageTime.cs` is administrative tooling, excluded from the plug-in DLL. It registers only this separate action/assembly and its two String members in `CRMSolution`, requires `prvReadmss_PressCoverage`, checks existing registration shape before updates, and reads back the signed assembly bytes. The exact UAT IDs/hash are recorded in `scripts/press-coverage/time-action-registration.json`. Revalidate the business timezone and environment before any separately approved promotion.

Microsoft references: [Server SDK contract](https://learn.microsoft.com/power-pages/configure/server-objects), [native time request](https://learn.microsoft.com/dotnet/api/microsoft.crm.sdk.messages.localtimefromutctimerequest), [Custom API registration](https://learn.microsoft.com/power-apps/developer/data-platform/create-custom-api-with-code).
