# Flow URL Environment Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Select the production meeting-report attachment flow only on the production portal hostname and use the Test flow everywhere else.

**Architecture:** Put the hostname decision in a small, tracked, pure TypeScript function so it can be tested without loading the ignored signed-URL file. The ignored `flowUrl.js` passes `window.location.hostname` and its two endpoints into that function, while `flowUrl.d.ts` continues to define the JavaScript module's public exports for TypeScript consumers.

**Tech Stack:** TypeScript 5.7, JavaScript ES modules, Vitest 2.1, Vite 6

## Global Constraints

- Match `oiac.powerappsportals.com` exactly for Production.
- Use Test for `oiac-engage-test.powerappsportals.com`, localhost, and every unknown hostname.
- Keep signed endpoint values only in the ignored `src/config/flowUrl.js` file.
- Preserve the existing `MEETING_REPORT_ATTACHMENT_FLOW_URL` import used by the attachment service.

---

### Task 1: Hostname-based flow URL selection

**Files:**
- Create: `oiac-engage/src/config/selectFlowUrl.ts`
- Create: `oiac-engage/src/config/selectFlowUrl.test.ts`
- Modify: `oiac-engage/src/config/flowUrl.js`
- Modify: `oiac-engage/src/config/flowUrl.d.ts`

**Interfaces:**
- Consumes: `hostname: string`, `productionUrl: string`, and `testUrl: string`.
- Produces: `selectMeetingReportAttachmentFlowUrl(hostname, productionUrl, testUrl): string` and the existing `MEETING_REPORT_ATTACHMENT_FLOW_URL: string` export.

- [x] **Step 1: Write the failing selector tests**

```ts
import { describe, expect, it } from 'vitest'
import { selectMeetingReportAttachmentFlowUrl } from './selectFlowUrl'

describe('selectMeetingReportAttachmentFlowUrl', () => {
  const productionUrl = 'https://flow.example/production'
  const testUrl = 'https://flow.example/test'

  it('uses Production on the production portal hostname', () => {
    expect(
      selectMeetingReportAttachmentFlowUrl(
        'oiac.powerappsportals.com',
        productionUrl,
        testUrl,
      ),
    ).toBe(productionUrl)
  })

  it.each([
    'oiac-engage-test.powerappsportals.com',
    'localhost',
    'preview.example.com',
  ])('uses Test on %s', (hostname) => {
    expect(
      selectMeetingReportAttachmentFlowUrl(hostname, productionUrl, testUrl),
    ).toBe(testUrl)
  })
})
```

- [x] **Step 2: Run the test and verify the missing module causes the expected failure**

Run: `npm test -- src/config/selectFlowUrl.test.ts`

Expected: FAIL because `./selectFlowUrl` does not exist.

- [x] **Step 3: Add the minimal pure selector**

```ts
const PRODUCTION_HOSTNAME = 'oiac.powerappsportals.com'

export function selectMeetingReportAttachmentFlowUrl(
  hostname: string,
  productionUrl: string,
  testUrl: string,
): string {
  return hostname === PRODUCTION_HOSTNAME ? productionUrl : testUrl
}
```

- [x] **Step 4: Run the selector tests**

Run: `npm test -- src/config/selectFlowUrl.test.ts`

Expected: PASS for the production, Test, localhost, and unknown-host cases.

- [x] **Step 5: Wire the ignored configuration into the selector**

Add this import at the top of `flowUrl.js`:

```js
import { selectMeetingReportAttachmentFlowUrl } from './selectFlowUrl'
```

After the two existing endpoint constants, export the resolved value:

```js
export const MEETING_REPORT_ATTACHMENT_FLOW_URL =
  selectMeetingReportAttachmentFlowUrl(
    window.location.hostname,
    MEETING_REPORT_ATTACHMENT_FLOW_URL_Prod,
    MEETING_REPORT_ATTACHMENT_FLOW_URL_Test,
  )
```

Replace `flowUrl.d.ts` with declarations matching all JavaScript exports:

```ts
export const MEETING_REPORT_ATTACHMENT_FLOW_URL_Prod: string
export const MEETING_REPORT_ATTACHMENT_FLOW_URL_Test: string
export const MEETING_REPORT_ATTACHMENT_FLOW_URL: string
```

- [x] **Step 6: Run focused tests and the production build**

Run: `npm test -- src/config/selectFlowUrl.test.ts src/features/meetingReports/meetingReportAttachmentService.test.ts`

Expected: all focused tests PASS.

Run: `npm run build`

Expected: TypeScript and Vite build successfully.

- [x] **Step 7: Confirm signed URLs remain ignored and commit tracked implementation files**

Run: `git check-ignore src/config/flowUrl.js`

Expected: `src/config/flowUrl.js` is printed.

Run: `git diff --cached -- src/config/flowUrl.js`

Expected: no output.

```bash
git add src/config/selectFlowUrl.ts src/config/selectFlowUrl.test.ts src/config/flowUrl.d.ts
git commit -m "feat: select flow URL by portal hostname"
```
