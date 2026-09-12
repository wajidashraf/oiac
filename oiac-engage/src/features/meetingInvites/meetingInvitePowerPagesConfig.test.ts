/// <reference types="vite/client" />

import { expect, test } from 'vitest'

const siteSettings = import.meta.glob('../../../.powerpages-site/site-settings/*.sitesetting.yml', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const tablePermissions = import.meta.glob('../../../.powerpages-site/table-permissions/*.tablepermission.yml', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const authenticatedUsersRoleId = '0353acdd-7b95-4c07-8997-ae95dafd978d'
const anonymousUsersRoleId = '0a919c57-3065-4cd3-aaa8-aec59acbbe67'

function metadata(files: Record<string, string>, fileName: string): string {
  const match = Object.entries(files).find(([path]) => path.endsWith(`/${fileName}`))
  expect(match, `${fileName} should exist`).toBeDefined()
  return match?.[1] ?? ''
}

function expectAuthenticatedOnly(value: string) {
  expect(value).toContain(`- ${authenticatedUsersRoleId}`)
  expect(value).not.toContain(anonymousUsersRoleId)
}

test('enables Meeting Invite reads with only the required columns and expansions', () => {
  const enabled = metadata(siteSettings, 'Webapi-mss_meetinginvites-enabled.sitesetting.yml')
  const fields = metadata(siteSettings, 'Webapi-mss_meetinginvites-fields.sitesetting.yml')
  const filter = metadata(siteSettings, 'Webapi-mss_meetinginvites-disableodatafilter.sitesetting.yml')

  expect(enabled).toContain('name: Webapi/mss_meetinginvites/enabled')
  expect(enabled).toContain('value: true')
  expect(filter).toContain('name: Webapi/mss_meetinginvites/disableodatafilter')
  expect(filter).toContain('value: false')
  for (const field of [
    'mss_meetinginvitesid', 'mss_meetingenddate', 'mss_meetingforall',
    'mss_meetingstartdate', 'mss_meetingtitle', 'mss_MeetingInvites_Contact_Contact',
    'mss_MeetingInvites_mss_District_mss_District',
  ]) expect(fields).toContain(field)
})

test('enables participant reads and Accept writes with both lookup representations', () => {
  const enabled = metadata(siteSettings, 'Webapi-mss_meetinginviteparticipant-enabled.sitesetting.yml')
  const fields = metadata(siteSettings, 'Webapi-mss_meetinginviteparticipant-fields.sitesetting.yml')
  const filter = metadata(siteSettings, 'Webapi-mss_meetinginviteparticipant-disableodatafilter.sitesetting.yml')

  expect(enabled).toContain('name: Webapi/mss_meetinginviteparticipant/enabled')
  expect(enabled).toContain('value: true')
  expect(filter).toContain('name: Webapi/mss_meetinginviteparticipant/disableodatafilter')
  expect(filter).toContain('value: false')
  for (const field of [
    'mss_meetinginviteparticipantid', 'mss_acceptedon', 'mss_contact', 'mss_Contact',
    '_mss_contact_value', 'mss_invitationstatus', 'mss_meetinginvite', 'mss_MeetingInvite',
    '_mss_meetinginvite_value', 'mss_name',
  ]) expect(fields).toContain(field)
})

test('grants authenticated users read-only global Meeting Invite access as a lookup target', () => {
  const permission = metadata(
    tablePermissions,
    'Authenticated-Meeting-Invites-Global-Read.tablepermission.yml',
  )
  expectAuthenticatedOnly(permission)
  expect(permission).toContain('entitylogicalname: mss_meetinginvites')
  expect(permission).toContain('scope: 756150000')
  expect(permission).toContain('read: true')
  expect(permission).toContain('create: false')
  expect(permission).toContain('write: false')
  expect(permission).toContain('delete: false')
  expect(permission).toContain('append: true')
  expect(permission).toContain('appendto: false')
})

test('limits participant management to records related to the signed-in Contact', () => {
  const permission = metadata(
    tablePermissions,
    'Authenticated-Owned-Meeting-Invite-Participant-Manage.tablepermission.yml',
  )
  expectAuthenticatedOnly(permission)
  expect(permission).toContain('entitylogicalname: mss_meetinginviteparticipant')
  expect(permission).toContain('scope: 756150001')
  expect(permission).toContain('contactrelationship: mss_meetinginviteparticipant_Contact_contact')
  expect(permission).toContain('read: true')
  expect(permission).toContain('create: true')
  expect(permission).toContain('write: true')
  expect(permission).toContain('delete: false')
  expect(permission).toContain('append: true')
  expect(permission).toContain('appendto: true')
})
