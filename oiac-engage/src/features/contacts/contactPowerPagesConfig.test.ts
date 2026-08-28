/// <reference types="vite/client" />

import { expect, test } from 'vitest'
import contactSelfRead from '../../../.powerpages-site/table-permissions/Contact-Self-Read.tablepermission.yml?raw'
import districtContactsRead from '../../../.powerpages-site/table-permissions/District-Contacts-Read.tablepermission.yml?raw'
import authenticatedDistrictRead from '../../../.powerpages-site/table-permissions/Authenticated-User-District-Read.tablepermission.yml?raw'
import disableODataFilter from '../../../.powerpages-site/site-settings/Webapi-contact-disableodatafilter.sitesetting.yml?raw'
import contactEnabled from '../../../.powerpages-site/site-settings/Webapi-contact-enabled.sitesetting.yml?raw'
import contactFields from '../../../.powerpages-site/site-settings/Webapi-contact-fields.sitesetting.yml?raw'
import innerError from '../../../.powerpages-site/site-settings/Webapi-error-innererror.sitesetting.yml?raw'

const authenticatedUsersRoleId = '0353acdd-7b95-4c07-8997-ae95dafd978d'
const anonymousUsersRoleId = '0a919c57-3065-4cd3-aaa8-aec59acbbe67'

function expectReadOnly(permission: string) {
  expect(permission).toContain('read: true')
  expect(permission).toContain('create: false')
  expect(permission).toContain('write: false')
  expect(permission).toContain('delete: false')
  expect(permission).toContain('append: false')
  expect(permission).toContain('appendto: false')
  expect(permission).toContain(`- ${authenticatedUsersRoleId}`)
  expect(permission).not.toContain(anonymousUsersRoleId)
}

test('enables only the required Contact Web API fields and secured filtering', () => {
  expect(contactEnabled).toContain('name: Webapi/contact/enabled')
  expect(contactEnabled).toContain('value: true')
  expect(contactFields).toContain('name: Webapi/contact/fields')
  expect(contactFields).toContain('value: "contactid,fullname,emailaddress1,mobilephone,address1_city,address1_stateorprovince,mss_district,_mss_district_value"')
  expect(disableODataFilter).toContain('name: Webapi/contact/disableodatafilter')
  expect(disableODataFilter).toContain('value: false')
  expect(innerError).toContain('name: Webapi/error/innererror')
  expect(innerError).toContain('value: false')
})

test('grants Authenticated Users a read-only district permission chain', () => {
  expectReadOnly(contactSelfRead)
  expect(contactSelfRead).toContain('entitylogicalname: contact')
  expect(contactSelfRead).toContain('scope: 756150004')

  expectReadOnly(authenticatedDistrictRead)
  expect(authenticatedDistrictRead).toContain('entitylogicalname: mss_district')
  expect(authenticatedDistrictRead).toContain('scope: 756150001')
  expect(authenticatedDistrictRead).toContain('contactrelationship: mss_contact_District_mss_district')

  const districtPermissionId = authenticatedDistrictRead.match(/^id: ([0-9a-f-]+)$/m)?.[1]
  expect(districtPermissionId).toBeDefined()
  expectReadOnly(districtContactsRead)
  expect(districtContactsRead).toContain('entitylogicalname: contact')
  expect(districtContactsRead).toContain('scope: 756150003')
  expect(districtContactsRead).toContain(`parententitypermission: ${districtPermissionId}`)
  expect(districtContactsRead).toContain('parentrelationship: mss_contact_District_mss_district')
})
