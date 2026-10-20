import { expect, test } from 'vitest'

const permissions = import.meta.glob('../../../.powerpages-site/table-permissions/Press-Coverage-*.tablepermission.yml', { eager: true, query: '?raw', import: 'default' })
const settings = import.meta.glob('../../../.powerpages-site/site-settings/{Webapi-mss_presscoverage-enabled,ServerLogic-Enabled}.sitesetting.yml', { eager: true, query: '?raw', import: 'default' })
const raw = (suffix: string) => String(Object.entries(permissions).find(([path]) => path.endsWith(suffix))?.[1] ?? '')

test('coverage can only be mutated through the protected Server Logic endpoint', () => {
  const disabled = String(Object.entries(settings).find(([path]) => path.includes('Webapi-mss_presscoverage'))?.[1] ?? '')
  expect(disabled).toContain('name: Webapi/mss_presscoverage/enabled')
  expect(disabled).toMatch(/value: (?:false|"false")/)
  const enabled = String(Object.entries(settings).find(([path]) => path.includes('ServerLogic-Enabled'))?.[1] ?? '')
  expect(enabled).toContain('name: ServerLogic/Enabled')
  expect(enabled).toMatch(/value: (?:true|"true")/)
})

test('all authenticated users can read coverage without a global write grant', () => {
  const permission = raw('Press-Coverage-Authenticated-Read.tablepermission.yml')
  expect(permission).toContain('0353acdd-7b95-4c07-8997-ae95dafd978d')
  expect(permission).toContain('entitylogicalname: mss_presscoverage')
  expect(permission).toContain('scope: 756150000')
  expect(permission).toContain('read: true')
  for (const privilege of ['create', 'write', 'delete', 'append', 'appendto']) expect(permission).toContain(`${privilege}: false`)
})

test('ordinary writes are scoped to the server-stamped Submitted By relationship', () => {
  const permission = raw('Press-Coverage-Creator-Manage.tablepermission.yml')
  expect(permission).toContain('scope: 756150001')
  expect(permission).toContain('contactrelationship: mss_presscoverage_SubmittedBy_contact')
  expect(permission).not.toContain('mss_presscoverage_RelatedContact_contact')
  for (const privilege of ['create', 'write', 'append', 'appendto']) expect(permission).toContain(`${privilege}: true`)
  expect(permission).toContain('delete: false')
  expect(permission).not.toContain('0353acdd-7b95-4c07-8997-ae95dafd978d')
  for (const role of ['b743c85b-4db3-484a-bd49-ff5ff975ec2b', '89a4fe62-4c85-48cb-b848-7603374faca2', 'c0ff381c-44a5-497b-b738-a442d62b07c1']) expect(permission).toContain(role)
})

test('only administrators receive global coverage management and no coverage role receives delete or anonymous access', () => {
  const administrator = raw('Press-Coverage-Administrator-Manage.tablepermission.yml')
  expect(administrator).toContain('6ec72c3e-4f1b-420f-9565-d20047b12c1f')
  expect(administrator).toContain('scope: 756150000')
  expect(administrator).toContain('write: true')
  expect(Object.keys(permissions)).toHaveLength(3)
  for (const permission of Object.values(permissions)) {
    expect(permission).not.toContain('0a919c57-3065-4cd3-aaa8-aec59acbbe67')
    expect(permission).toContain('delete: false')
  }
})
