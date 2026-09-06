const PRODUCTION_HOSTNAME = 'oiac.powerappsportals.com'

export function selectMeetingReportAttachmentFlowUrl(
  hostname: string,
  productionUrl: string,
  testUrl: string,
): string {
  return hostname === PRODUCTION_HOSTNAME ? productionUrl : testUrl
}
