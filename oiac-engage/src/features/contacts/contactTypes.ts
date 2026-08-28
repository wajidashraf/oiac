export type ContactRecord = {
  readonly contactid: string
  readonly fullname?: string | null
  readonly emailaddress1?: string | null
  readonly mobilephone?: string | null
  readonly address1_city?: string | null
  readonly address1_stateorprovince?: string | null
  readonly _mss_district_value?: string | null
}

export type DistrictContact = {
  readonly id: string
  readonly fullName: string | null
  readonly email: string | null
  readonly mobilePhone: string | null
  readonly city: string | null
  readonly stateOrProvince: string | null
  readonly districtId: string
}

export type ContactPage = {
  readonly contacts: readonly DistrictContact[]
  readonly hasNext: boolean
}

export type ContactQuery = {
  readonly districtId: string
  readonly page: number
  readonly search: string
}
