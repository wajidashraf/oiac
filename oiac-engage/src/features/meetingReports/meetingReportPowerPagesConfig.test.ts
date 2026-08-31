/// <reference types="vite/client" />

import { expect, test } from 'vitest'
import contactFields from '../../../.powerpages-site/site-settings/Webapi-contact-fields.sitesetting.yml?raw'
import districtEnabled from '../../../.powerpages-site/site-settings/Webapi-mss_district-enabled.sitesetting.yml?raw'
import districtFields from '../../../.powerpages-site/site-settings/Webapi-mss_district-fields.sitesetting.yml?raw'
import districtFilter from '../../../.powerpages-site/site-settings/Webapi-mss_district-disableodatafilter.sitesetting.yml?raw'
import reportEnabled from '../../../.powerpages-site/site-settings/Webapi-mss_meetingreport-enabled.sitesetting.yml?raw'
import reportFields from '../../../.powerpages-site/site-settings/Webapi-mss_meetingreport-fields.sitesetting.yml?raw'
import reportFilter from '../../../.powerpages-site/site-settings/Webapi-mss_meetingreport-disableodatafilter.sitesetting.yml?raw'
import contactDirectory from '../../../.powerpages-site/table-permissions/Authenticated-Contact-Directory-Read-Append.tablepermission.yml?raw'
import districtDirectory from '../../../.powerpages-site/table-permissions/Authenticated-District-Global-Read.tablepermission.yml?raw'
import ownedReports from '../../../.powerpages-site/table-permissions/Authenticated-Owned-Meeting-Report-Manage.tablepermission.yml?raw'

const authenticatedUsersRoleId = '0353acdd-7b95-4c07-8997-ae95dafd978d'
const anonymousUsersRoleId = '0a919c57-3065-4cd3-aaa8-aec59acbbe67'

function expectAuthenticatedOnly(metadata: string) {
  expect(metadata).toContain(`- ${authenticatedUsersRoleId}`)
  expect(metadata).not.toContain(anonymousUsersRoleId)
}

test('exposes only the fields required by the meeting report workflow', () => {
  expect(contactFields).toContain('jobtitle')

  expect(districtEnabled).toContain('name: Webapi/mss_district/enabled')
  expect(districtEnabled).toContain('value: true')
  expect(districtFields).toContain('name: Webapi/mss_district/fields')
  expect(districtFields).toContain('value: "mss_districtid,mss_number"')
  expect(districtFilter).toContain('name: Webapi/mss_district/disableodatafilter')
  expect(districtFilter).toContain('value: false')

  expect(reportEnabled).toContain('name: Webapi/mss_meetingreport/enabled')
  expect(reportEnabled).toContain('value: true')
  expect(reportFields).toContain('name: Webapi/mss_meetingreport/fields')
  for (const field of [
    'mss_meetingreportid', 'mss_subject', 'mss_dateofmeeting', 'mss_startdateandtime',
    'mss_enddateandtime', 'mss_documentsprovided', 'mss_representative',
    '_mss_representative_value', 'mss_district', '_mss_district_value', 'mss_meetingformat',
    'mss_writedownwhatthestaffsaidnotwhatyousaid', 'mss_followupnoteoncethemeetingended',
    'mss_overallsentiment', 'mss_reportedby', '_mss_reportedby_value',
  ]) expect(reportFields).toContain(field)
  for (const navigationProperty of [
    'mss_Representative',
    'mss_District',
    'mss_Reportedby',
    'mss_MeetingReport_Contact_Staff',
    'mss_MeetingReport_Contact_Volunteers',
  ]) {
    expect(reportFields).toContain(navigationProperty)
  }
  expect(reportFilter).toContain('name: Webapi/mss_meetingreport/disableodatafilter')
  expect(reportFilter).toContain('value: false')
})

test('grants all-district Contact lookup access without Contact write access', () => {
  expectAuthenticatedOnly(contactDirectory)
  expect(contactDirectory).toContain('entitylogicalname: contact')
  expect(contactDirectory).toContain('scope: 756150000')
  expect(contactDirectory).toContain('read: true')
  expect(contactDirectory).toContain('append: true')
  expect(contactDirectory).toContain('appendto: true')
  expect(contactDirectory).toContain('create: false')
  expect(contactDirectory).toContain('write: false')
  expect(contactDirectory).toContain('delete: false')
})

test('allows Meeting Reports to associate with read-only District lookup records', () => {
  expectAuthenticatedOnly(districtDirectory)
  expect(districtDirectory).toContain('entitylogicalname: mss_district')
  expect(districtDirectory).toContain('scope: 756150000')
  expect(districtDirectory).toContain('read: true')
  expect(districtDirectory).toContain('create: false')
  expect(districtDirectory).toContain('write: false')
  expect(districtDirectory).toContain('delete: false')
  expect(districtDirectory).toContain('append: true')
  expect(districtDirectory).toContain('appendto: true')
})

test('limits report management to reports related to the authenticated Contact', () => {
  expectAuthenticatedOnly(ownedReports)
  expect(ownedReports).toContain('entitylogicalname: mss_meetingreport')
  expect(ownedReports).toContain('scope: 756150001')
  expect(ownedReports).toContain('contactrelationship: mss_meetingreport_Reportedby_contact')
  expect(ownedReports).toContain('read: true')
  expect(ownedReports).toContain('create: true')
  expect(ownedReports).toContain('write: true')
  expect(ownedReports).toContain('append: true')
  expect(ownedReports).toContain('appendto: true')
  expect(ownedReports).toContain('delete: false')
})
