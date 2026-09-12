import { powerPagesFetch } from '../../shared/powerPagesApi'
import {
  MEETING_INVITATION_STATUS,
  type MeetingInvitationStatus,
  type MeetingInvite,
  type MeetingInviteCollection,
  type MeetingInviteParticipant,
} from './meetingInviteTypes'

export { MEETING_INVITATION_STATUS } from './meetingInviteTypes'
export type {
  MeetingInvitationStatus,
  MeetingInvite,
  MeetingInviteCollection,
  MeetingInviteParticipant,
} from './meetingInviteTypes'

type CollectionEnvelope = { readonly value?: unknown }
type DataRecord = Record<string, unknown>

const inviteSelect = [
  'mss_meetinginvitesid',
  'mss_meetingenddate',
  'mss_meetingforall',
  'mss_meetingstartdate',
  'mss_meetingtitle',
].join(',')

const participantSelect = [
  'mss_meetinginviteparticipantid',
  'mss_acceptedon',
  '_mss_contact_value',
  'mss_invitationstatus',
  '_mss_meetinginvite_value',
  'mss_name',
].join(',')

function isRecord(value: unknown): value is DataRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeGuid(value: unknown, label: string): string {
  const normalized = typeof value === 'string'
    ? value.trim().replace(/^\{+|\}+$/g, '').toLowerCase()
    : ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)) {
    throw new Error(`A valid ${label} ID is required.`)
  }
  return normalized
}

function optionalGuid(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null
  return normalizeGuid(value, label)
}

function collectionRows(envelope: CollectionEnvelope): readonly unknown[] {
  if (!Array.isArray(envelope?.value)) throw new Error('Meeting invites could not be loaded.')
  return envelope.value
}

function isStatus(value: unknown): value is MeetingInvitationStatus {
  return value === MEETING_INVITATION_STATUS.accepted
    || value === MEETING_INVITATION_STATUS.pending
    || value === MEETING_INVITATION_STATUS.rejected
}

function mapParticipant(value: unknown): MeetingInviteParticipant {
  if (!isRecord(value) || !isStatus(value.mss_invitationstatus)) {
    throw new Error('Meeting invites could not be loaded.')
  }

  return {
    id: normalizeGuid(value.mss_meetinginviteparticipantid, 'Meeting Invite Participant'),
    contactId: normalizeGuid(value._mss_contact_value, 'Contact'),
    meetingInviteId: normalizeGuid(value._mss_meetinginvite_value, 'Meeting Invite'),
    status: value.mss_invitationstatus,
    acceptedOn: typeof value.mss_acceptedon === 'string' ? value.mss_acceptedon : null,
    name: typeof value.mss_name === 'string' ? value.mss_name : null,
  }
}

function relatedIds(value: unknown, key: 'contactid' | 'mss_districtid'): readonly string[] {
  if (!Array.isArray(value)) throw new Error('Meeting invites could not be loaded.')
  return value.map((item) => {
    if (!isRecord(item)) throw new Error('Meeting invites could not be loaded.')
    return normalizeGuid(item[key], key === 'contactid' ? 'Contact' : 'District')
  })
}

function participantRank(status: MeetingInvitationStatus): number {
  if (status === MEETING_INVITATION_STATUS.accepted) return 3
  if (status === MEETING_INVITATION_STATUS.pending) return 2
  return 1
}

function acceptedTime(value: string | null): number {
  const time = value ? Date.parse(value) : Number.NaN
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

function selectParticipant(
  participants: readonly MeetingInviteParticipant[],
  inviteId: string,
): MeetingInviteParticipant | null {
  return participants
    .filter((participant) => participant.meetingInviteId === inviteId)
    .sort((left, right) => participantRank(right.status) - participantRank(left.status)
      || acceptedTime(right.acceptedOn) - acceptedTime(left.acceptedOn)
      || left.id.localeCompare(right.id))[0] ?? null
}

function inviteStartTime(value: string): number {
  const time = Date.parse(value)
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
}

export async function getMeetingInvites(
  contactIdValue: string,
  signal?: AbortSignal,
): Promise<MeetingInviteCollection> {
  const contactId = normalizeGuid(contactIdValue, 'Contact')
  const inviteParams = new URLSearchParams({
    $select: inviteSelect,
    $expand: [
      'mss_MeetingInvites_Contact_Contact($select=contactid)',
      'mss_MeetingInvites_mss_District_mss_District($select=mss_districtid)',
    ].join(','),
  })
  const participantParams = new URLSearchParams({
    $select: participantSelect,
    $filter: `_mss_contact_value eq ${contactId}`,
  })

  const [profileValue, inviteEnvelope, participantEnvelope] = await Promise.all([
    powerPagesFetch<unknown>(
      `/_api/contacts(${contactId})?$select=contactid,fullname,_mss_district_value`,
      { signal },
    ),
    powerPagesFetch<CollectionEnvelope>(`/_api/mss_meetinginviteses?${inviteParams.toString()}`, { signal }),
    powerPagesFetch<CollectionEnvelope>(
      `/_api/mss_meetinginviteparticipants?${participantParams.toString()}`,
      { signal },
    ),
  ])

  if (!isRecord(profileValue) || typeof profileValue.fullname !== 'string') {
    throw new Error('Meeting invites could not be loaded.')
  }
  const profileContactId = normalizeGuid(profileValue.contactid, 'Contact')
  if (profileContactId !== contactId) throw new Error('Meeting invites could not be loaded.')
  const districtId = optionalGuid(profileValue._mss_district_value, 'District')
  const participants = collectionRows(participantEnvelope).map(mapParticipant)

  const invites = collectionRows(inviteEnvelope).flatMap((value): MeetingInvite[] => {
    if (!isRecord(value)
      || typeof value.mss_meetingtitle !== 'string'
      || typeof value.mss_meetingstartdate !== 'string') {
      throw new Error('Meeting invites could not be loaded.')
    }
    const id = normalizeGuid(value.mss_meetinginvitesid, 'Meeting Invite')
    const contactIds = relatedIds(value.mss_MeetingInvites_Contact_Contact, 'contactid')
    const districtIds = relatedIds(
      value.mss_MeetingInvites_mss_District_mss_District,
      'mss_districtid',
    )
    const isEligible = value.mss_meetingforall === true
      || contactIds.includes(contactId)
      || (districtId !== null && districtIds.includes(districtId))
    if (!isEligible) return []

    return [{
      id,
      title: value.mss_meetingtitle,
      startDateTime: value.mss_meetingstartdate,
      endDateTime: typeof value.mss_meetingenddate === 'string' ? value.mss_meetingenddate : null,
      participant: selectParticipant(participants, id),
    }]
  }).sort((left, right) => inviteStartTime(left.startDateTime) - inviteStartTime(right.startDateTime)
    || left.id.localeCompare(right.id))

  return { contactFullName: profileValue.fullname, invites }
}
