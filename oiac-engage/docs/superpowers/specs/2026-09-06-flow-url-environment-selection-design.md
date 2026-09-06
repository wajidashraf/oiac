# Flow URL Environment Selection

## Goal

Select the meeting-report attachment Power Automate endpoint at runtime from the portal hostname.

## Behavior

- `oiac.powerappsportals.com` uses `MEETING_REPORT_ATTACHMENT_FLOW_URL_Prod`.
- `oiac-engage-test.powerappsportals.com` uses `MEETING_REPORT_ATTACHMENT_FLOW_URL_Test`.
- Local development and every other hostname use the Test URL, preventing accidental production calls.

Hostname comparison is exact and relies on `window.location.hostname`, which excludes the URL scheme, path, and port.

## Files and API

The ignored `src/config/flowUrl.js` keeps the two signed endpoint constants and exports `MEETING_REPORT_ATTACHMENT_FLOW_URL` as the selected value. The committed `src/config/flowUrl.d.ts` declares all JavaScript exports so TypeScript consumers see the correct module shape. Existing service imports remain unchanged.

## Verification

Verify the hostname-selection cases with an automated test where practical, then run the project build to confirm JavaScript/TypeScript module compatibility. The signed endpoint values remain only in the ignored local configuration file.
