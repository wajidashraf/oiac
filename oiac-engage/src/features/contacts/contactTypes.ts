export type ContactRecord = {
  readonly contactid: string
  readonly fullname?: string | null
  readonly firstname?: string | null
  readonly lastname?: string | null
  readonly emailaddress1?: string | null
  readonly jobtitle?: string | null
  readonly mobilephone?: string | null
  readonly address1_city?: string | null
  readonly address1_stateorprovince?: string | null
  readonly address1_postalcode?: string | null
  readonly _mss_district_value?: string | null
  readonly '_mss_district_value@OData.Community.Display.V1.FormattedValue'?: string | null
}

export type DistrictContact = {
  readonly id: string
  readonly fullName: string | null
  readonly firstName: string | null
  readonly lastName: string | null
  readonly email: string | null
  readonly jobTitle: string | null
  readonly mobilePhone: string | null
  readonly city: string | null
  readonly stateOrProvince: string | null
  readonly postalCode: string | null
  readonly districtName: string | null
  readonly districtId: string | null
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

export type AdminContactQuery = {
  readonly search: string
  readonly nextLink?: string | null
}

export type AdminContactUpdate = {
  readonly firstName: string
  readonly lastName: string
  readonly jobTitle: string
  readonly mobilePhone: string
  readonly city: string
  readonly stateOrProvince: string
  readonly postalCode: string
  readonly districtId: string | null
}
