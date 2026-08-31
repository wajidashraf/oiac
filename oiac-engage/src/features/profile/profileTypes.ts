export type ProfileContact = {
  readonly contactid: string
  readonly firstname?: string | null
  readonly lastname?: string | null
  readonly address1_city?: string | null
  readonly address1_stateorprovince?: string | null
}

export type ProfileFormValues = {
  readonly firstName: string
  readonly lastName: string
  readonly city: string
  readonly state: string
}

export type ProfileUpdate = {
  readonly firstname: string
  readonly lastname: string
  readonly address1_city: string | null
  readonly address1_stateorprovince: string | null
}
