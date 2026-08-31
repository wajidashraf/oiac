export type ContactRecord = {
  readonly contactid: string
  readonly fullname?: string | null
  readonly emailaddress1?: string | null
  readonly mobilephone?: string | null
  readonly address1_city?: string | null
  readonly _mss_district_value?: string | null
  readonly '_mss_district_value@OData.Community.Display.V1.FormattedValue'?: string | null
}

export type DistrictContact = {
  readonly id: string
  readonly fullName: string | null
  readonly email: string | null
  readonly mobilePhone: string | null
  readonly city: string | null
  readonly districtName: string | null
  readonly districtId: string
}

export type ContactPage = {
  readonly contacts: readonly DistrictContact[]
  readonly hasNext: boolean
  readonly nextLink: string | null
}

export type ContactQuery = {
  readonly districtId: string
  readonly search: string
  readonly nextLink?: string | null
}
