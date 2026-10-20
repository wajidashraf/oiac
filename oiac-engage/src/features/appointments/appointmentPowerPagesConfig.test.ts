import { expect, test } from 'vitest'

const permissions = import.meta.glob('../../../.powerpages-site/table-permissions/Appointments-*.tablepermission.yml', { eager: true, query: '?raw', import: 'default' })
const settings = import.meta.glob('../../../.powerpages-site/site-settings/Webapi-mss_appointment-enabled.sitesetting.yml', { eager: true, query: '?raw', import: 'default' })
const metadata = import.meta.glob('../../../.powerpages-site/server-logic/appointments/appointments.serverlogic.yml', { eager: true, query: '?raw', import: 'default' })
const read = (name: string) => String(Object.entries(permissions).find(([path]) => path.endsWith(`${name}.tablepermission.yml`))?.[1] ?? '')

test('only the authenticated server endpoint exposes Appointments, with no direct portal Web API', () => {
  expect(Object.values(settings).join()).toContain('name: Webapi/mss_appointment/enabled')
  expect(Object.values(settings).join()).toMatch(/value: (?:false|"false")/)
  const endpoint = Object.values(metadata).join()
  expect(endpoint).toContain('name: appointments')
  expect(endpoint).toContain('0353acdd-7b95-4c07-8997-ae95dafd978d')
  expect(endpoint).not.toContain('0a919c57-3065-4cd3-aaa8-aec59acbbe67')
})

test('participant read grants use separate requester and recipient relationships', () => {
  for (const [name, relationship] of [['Appointments-Requester-Read', 'mss_appointment_Requester_contact'], ['Appointments-Recipient-Read', 'mss_appointment_Contact_contact']]) {
    const permission = read(name)
    expect(permission).toContain('0353acdd-7b95-4c07-8997-ae95dafd978d')
    expect(permission).toContain('scope: 756150001')
    expect(permission).toContain(`contactrelationship: ${relationship}`)
  }
})

test('only administrators receive global read and no portal role receives direct mutations or anonymous access', () => {
  const admin = read('Appointments-Administrator-Read')
  expect(admin).toContain('scope: 756150000')
  expect(admin).toContain('6ec72c3e-4f1b-420f-9565-d20047b12c1f')
  expect(Object.keys(permissions)).toHaveLength(3)
  for (const permission of Object.values(permissions)) {
    expect(permission).toContain('entitylogicalname: mss_appointment')
    expect(permission).toContain('read: true')
    expect(permission).not.toContain('0a919c57-3065-4cd3-aaa8-aec59acbbe67')
    for (const privilege of ['create', 'write', 'delete', 'append', 'appendto']) expect(permission).toContain(`${privilege}: false`)
  }
})
