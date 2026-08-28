export type DistrictContact = {
  id: string
  fullName: string
  mobilePhone: string
  phoneHref: string
  email: string
  state: string
  city: string
}

export const districtContacts: readonly DistrictContact[] = [
  {
    id: 'sara-rahimi',
    fullName: 'Sara Rahimi',
    mobilePhone: '+1 (202) 555-0142',
    phoneHref: 'tel:+12025550142',
    email: 'sara.rahimi@oiac.org',
    state: 'DC',
    city: 'Washington',
  },
  {
    id: 'reza-ahmadi',
    fullName: 'Reza Ahmadi',
    mobilePhone: '+1 (703) 555-0122',
    phoneHref: 'tel:+17035550122',
    email: 'r.ahmadi@oiac.org',
    state: 'VA',
    city: 'Arlington',
  },
]
