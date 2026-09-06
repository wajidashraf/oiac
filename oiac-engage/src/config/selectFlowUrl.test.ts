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
