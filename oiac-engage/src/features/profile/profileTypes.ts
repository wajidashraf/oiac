export type ProfileContact = {
  readonly contactid: string
  readonly firstname?: string | null
  readonly lastname?: string | null
  readonly emailaddress1?: string | null
  readonly mobilephone?: string | null
  readonly address1_city?: string | null
  readonly address1_stateorprovince?: string | null
  readonly address1_postalcode?: string | null
  readonly _mss_district_value?: string | null
  readonly '_mss_district_value@OData.Community.Display.V1.FormattedValue'?: string | null
}

export type ProfileFormValues = {
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly mobilePhone: string
  readonly city: string
  readonly state: string
  readonly postalCode: string
  readonly districtId: string | null
  readonly districtName: string
}

export type ProfileUpdate = {
  readonly firstname: string
  readonly lastname: string
  readonly mobilephone: string | null
  readonly address1_city: string | null
  readonly address1_stateorprovince: string | null
  readonly address1_postalcode: string | null
  readonly 'mss_District@odata.bind'?: string
}
