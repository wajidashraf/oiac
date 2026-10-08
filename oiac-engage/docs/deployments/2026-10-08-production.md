# Production deployment: 8 October 2026

The Home page Recent Documents card is excluded for all users. Contacts pagination and other application features remain unchanged. Unrelated working changes were excluded from the deployment.

- Source commit: `3fcc91d` (`fix: hide Recent Documents card on home`).
- Site: OIAC Engage, `e7f400bd-1e04-4efa-b8b3-7a7a3b168662`.
- Environment: `ca557a8d-626a-ed50-b1e7-ca05693b4405`.
- Dataverse: `https://oiac.crm.dynamics.com/`.
- Public portal: `https://oiac.powerappsportals.com/`.
- Deployment command: `pac pages upload-code-site --rootPath <isolated project>` using PAC CLI 2.13.1.
- Upload succeeded: 59/59 events, 279 records across 48 entities, 140.12 seconds.
- Clean dependency installation: `npm ci --no-audit --no-fund`.
- Verification: all 552 tests in 61 files passed; production build succeeded.
- Published JavaScript: `index-CW6cVbmr.js`.
- JavaScript SHA-256: `E1A51751787E6107DD9900A615D9EFD7C690D56EE1A9B5063C555ED4416814E5`.
- CSS: `index-DiwxZ9wP.css`.
- Live verification: portal returned HTTP 200, referenced the new bundle, and served JavaScript matching the tested build byte for byte.
- Activation, cache restart, and environment-wide setting changes were unnecessary.

Earlier uploads with PAC 2.11.2 and 2.9.3 failed with client pool acquisition timeouts. The successful attempt used the current official PAC package in an isolated directory; global installations were preserved.

## Deployment guide review

`DEPLOYMENT.md` was reviewed before the successful retry and left unchanged. Its code-site upload procedure and target verification requirements were followed. Review findings:

- The environment inventory covers Development and Test/UAT but omits Production.
- The guide's header and footer template IDs differ from the tracked website metadata. The tracked header is `1a8d7f5c-7e6b-4a4f-b9d5-2f3c6a1e8b70`; the tracked footer is `5c3e9a12-4b7d-4f8a-a6c1-9e2d7b5f3048`.
- The guide has no troubleshooting instructions for client pool acquisition timeouts. Its HTML blocked-attachment workaround did not apply to this failure.

The local DeploySite usage counter was incremented after upload for tracking. No additional deployment was performed for that counter.
