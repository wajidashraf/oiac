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

test('enables read-only Teams announcement Web API access with the exact validated fields', () => {
  const enabled = metadata(
    siteSettings,
    'Webapi-mss_teamsannouncements-enabled.sitesetting.yml',
  )
  const fields = metadata(
    siteSettings,
    'Webapi-mss_teamsannouncements-fields.sitesetting.yml',
  )
  const filter = metadata(
    siteSettings,
    'Webapi-mss_teamsannouncements-disableodatafilter.sitesetting.yml',
  )

  expect(enabled).toContain('name: Webapi/mss_teamsannouncements/enabled')
  expect(enabled).toContain('value: true')
  expect(filter).toContain('name: Webapi/mss_teamsannouncements/disableodatafilter')
  expect(filter).toContain('value: false')
  expect(fields).toContain(
    'value: "mss_teamsannouncementsid,mss_announcementlink,mss_content,mss_enddate,mss_startdate,mss_title"',
  )
})

test('grants only authenticated users global read access to Teams announcements', () => {
  const permission = metadata(
    tablePermissions,
    'Authenticated-Teams-Announcements-Global-Read.tablepermission.yml',
  )

  expect(permission).toContain(`- ${authenticatedUsersRoleId}`)
  expect(permission).not.toContain(anonymousUsersRoleId)
  expect(permission).toContain('entitylogicalname: mss_teamsannouncements')
  expect(permission).toContain('scope: 756150000')
  expect(permission).toContain('read: true')
  expect(permission).toContain('create: false')
  expect(permission).toContain('write: false')
  expect(permission).toContain('delete: false')
  expect(permission).toContain('append: false')
  expect(permission).toContain('appendto: false')
})
