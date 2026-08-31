/// <reference types="vite/client" />

import { expect, test } from 'vitest'
import registrationEnabled from '../../../.powerpages-site/site-settings/Webapi-mss_eventregistration-enabled.sitesetting.yml?raw'
import registrationFields from '../../../.powerpages-site/site-settings/Webapi-mss_eventregistration-fields.sitesetting.yml?raw'
import registrationFilter from '../../../.powerpages-site/site-settings/Webapi-mss_eventregistration-disableodatafilter.sitesetting.yml?raw'
import eventPermission from '../../../.powerpages-site/table-permissions/Events-Global-Read.tablepermission.yml?raw'
import ownedRegistrations from '../../../.powerpages-site/table-permissions/Authenticated-Owned-Event-Registration-Manage.tablepermission.yml?raw'

const authenticatedUsersRoleId = '0353acdd-7b95-4c07-8997-ae95dafd978d'
const anonymousUsersRoleId = '0a919c57-3065-4cd3-aaa8-aec59acbbe67'
const volunteerRoleId = 'b743c85b-4db3-484a-bd49-ff5ff975ec2b'

test('enables filtered Event Registration Web API access with an explicit field allowlist', () => {
  expect(registrationEnabled).toContain('name: Webapi/mss_eventregistration/enabled')
  expect(registrationEnabled).toContain('value: true')
  expect(registrationFilter).toContain('name: Webapi/mss_eventregistration/disableodatafilter')
  expect(registrationFilter).toContain('value: false')

  for (const field of [
    'mss_eventregistrationid', '_mss_contact_value', '_mss_event_value',
    'mss_registrationdate', 'mss_registrationnumber', 'mss_registrationstatus',
    'mss_Contact', 'mss_Event',
  ]) expect(registrationFields).toContain(field)
})

test('limits Event Registration management to rows related to the signed-in Contact', () => {
  expect(ownedRegistrations).toContain(`- ${authenticatedUsersRoleId}`)
  expect(ownedRegistrations).not.toContain(anonymousUsersRoleId)
  expect(ownedRegistrations).toContain('entitylogicalname: mss_eventregistration')
  expect(ownedRegistrations).toContain('scope: 756150001')
  expect(ownedRegistrations).toContain('contactrelationship: mss_eventregistration_Contact_contact')
  expect(ownedRegistrations).toContain('read: true')
  expect(ownedRegistrations).toContain('create: true')
  expect(ownedRegistrations).toContain('write: true')
  expect(ownedRegistrations).toContain('delete: false')
  expect(ownedRegistrations).toContain('append: true')
  expect(ownedRegistrations).toContain('appendto: true')
})

test('allows Event records to be lookup targets without granting Event mutation access', () => {
  expect(eventPermission).toContain(`- ${authenticatedUsersRoleId}`)
  expect(eventPermission).not.toContain(volunteerRoleId)
  expect(eventPermission).not.toContain(anonymousUsersRoleId)
  expect(eventPermission).toContain('read: true')
  expect(eventPermission).toContain('append: true')
  expect(eventPermission).toContain('appendto: true')
  expect(eventPermission).toContain('create: false')
  expect(eventPermission).toContain('write: false')
  expect(eventPermission).toContain('delete: false')
})
