/// <reference types="vite/client" />

import { expect, test } from 'vitest'
import enabled from '../../../.powerpages-site/site-settings/Webapi-mss_events-enabled.sitesetting.yml?raw'
import fields from '../../../.powerpages-site/site-settings/Webapi-mss_events-fields.sitesetting.yml?raw'
import adminPermission from '../../../.powerpages-site/table-permissions/Events-Admin-Manage.tablepermission.yml?raw'
import authenticatedPermission from '../../../.powerpages-site/table-permissions/Events-Global-Read.tablepermission.yml?raw'

test('enables the Events Web API with the explicit Event field allowlist', () => {
  expect(enabled).toContain('name: Webapi/mss_events/enabled')
  expect(enabled).toContain('value: true')
  expect(fields).toContain('name: Webapi/mss_events/fields')
  for (const field of [
    'mss_eventsid', 'mss_eventname', 'mss_description', 'mss_eventtype',
    'mss_eventformat', 'mss_startdatetime', 'mss_enddatetime', 'mss_eventstatus',
    'mss_venuename', 'mss_address', 'mss_city', 'mss_meetingurl',
  ]) expect(fields).toContain(field)
})

test('keeps administrator management and authenticated-user Event read permissions', () => {
  expect(adminPermission).toContain('- 6ec72c3e-4f1b-420f-9565-d20047b12c1f')
  expect(adminPermission).toContain('entitylogicalname: mss_events')
  expect(adminPermission).toContain('read: true')
  expect(adminPermission).toContain('create: true')
  expect(adminPermission).toContain('write: true')

  expect(authenticatedPermission).toContain('- 0353acdd-7b95-4c07-8997-ae95dafd978d')
  expect(authenticatedPermission).toContain('entitylogicalname: mss_events')
  expect(authenticatedPermission).toContain('scope: 756150000')
  expect(authenticatedPermission).toContain('read: true')
  expect(authenticatedPermission).toContain('create: false')
  expect(authenticatedPermission).toContain('write: false')
})
