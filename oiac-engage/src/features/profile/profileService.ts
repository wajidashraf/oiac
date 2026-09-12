import { powerPagesFetch } from '../../shared/powerPagesApi'
import type { ProfileContact, ProfileFormValues, ProfileUpdate } from './profileTypes'

const CONTACT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PROFILE_SELECT = [
  'contactid',
  'firstname',
  'lastname',
  'emailaddress1',
  'mobilephone',
  'address1_city',
  'address1_stateorprovince',
  'address1_postalcode',
  '_mss_district_value',
].join(',')
const INVALID_CONTACT_MESSAGE = 'The Power Pages session did not provide a valid Contact identifier.'

export function normalizeProfileContactId(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/^\{(.+)\}$/, '$1').toLocaleLowerCase() ?? ''
  return CONTACT_ID_PATTERN.test(normalized) ? normalized : null
}

function requireContactId(value: string): string {
  const contactId = normalizeProfileContactId(value)
  if (!contactId) throw new Error(INVALID_CONTACT_MESSAGE)
  return contactId
}

function textValue(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function mapProfile(record: ProfileContact): ProfileFormValues {
  const districtId = normalizeProfileContactId(record._mss_district_value)
  const districtName = textValue(
    record['_mss_district_value@OData.Community.Display.V1.FormattedValue'],
  )

  return {
    firstName: textValue(record.firstname),
    lastName: textValue(record.lastname),
    email: textValue(record.emailaddress1),
    mobilePhone: textValue(record.mobilephone),
    city: textValue(record.address1_city),
    state: textValue(record.address1_stateorprovince),
    postalCode: textValue(record.address1_postalcode),
    districtId,
    districtName: districtName || (districtId ? 'Selected district' : ''),
  }
}

function normalizeValues(values: ProfileFormValues): ProfileFormValues {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    mobilePhone: values.mobilePhone.trim(),
    city: values.city.trim(),
    state: values.state.trim(),
    postalCode: values.postalCode.trim(),
    districtId: values.districtId ? requireContactId(values.districtId) : null,
    districtName: values.districtName.trim(),
  }
}

export async function getMyProfile(
  contactIdValue: string,
  signal?: AbortSignal,
): Promise<ProfileFormValues> {
  const contactId = requireContactId(contactIdValue)
  const record = await powerPagesFetch<ProfileContact>(
    `/_api/contacts(${contactId})?$select=${PROFILE_SELECT}`,
    {
      signal,
      headers: {
        Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
      },
    },
  )
  return mapProfile(record)
}

export async function updateMyProfile(
  contactIdValue: string,
  values: ProfileFormValues,
  storedDistrictId: string | null,
): Promise<ProfileFormValues> {
  const contactId = requireContactId(contactIdValue)
  const normalized = normalizeValues(values)
  const payload: ProfileUpdate = {
    firstname: normalized.firstName,
    lastname: normalized.lastName,
    mobilephone: normalized.mobilePhone || null,
    address1_city: normalized.city || null,
    address1_stateorprovince: normalized.state || null,
    address1_postalcode: normalized.postalCode || null,
    ...(!storedDistrictId && normalized.districtId
      ? { 'mss_District@odata.bind': `/mss_districts(${normalized.districtId})` }
      : {}),
  }

  await powerPagesFetch<void>(`/_api/contacts(${contactId})`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'If-Match': '*',
    },
    body: JSON.stringify(payload),
  })

  return normalized
}
