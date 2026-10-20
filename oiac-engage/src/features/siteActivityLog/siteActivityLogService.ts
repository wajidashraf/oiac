import { PowerPagesDataError, powerPagesFetch } from '../../shared/powerPagesApi'
export type HistoryScope = 'mine' | 'all'
export type HistoryQuery = { scope: HistoryScope; page: number; module: number | null; action: number | null; from: string | null; to: string | null }
export type HistoryEntry = { id: string; actorName: string; action: number; module: number; recordType: string; recordId: string; recordTitle: string; occurredOn: string; summary: string }
export type HistoryDetail = HistoryEntry & { details: Record<string, unknown> }
export type HistoryPage = { entries: HistoryEntry[]; nextPage: number | null; totalCount: number | null; canViewAll: boolean }
export const historyActions = ['Created', 'Updated', 'Submitted', 'Registered', 'Approved', 'Rejected', 'Accepted', 'Cancelled', 'Closed', 'Reopened', 'Rescheduled', 'Published', 'Uploaded', 'Joined', 'Left', 'Profile Updated', 'Password Changed', 'Deleted'].map((label, i) => ({ label, value: 866530000 + i }))
export const historyModules = ['Meeting Reports', 'Events', 'Registrations', 'Appointments', 'Press Coverage', 'Activity Channel', 'Contacts', 'Profile'].map((label, i) => ({ label, value: 866530000 + i }))
export const historyLabel = (options: typeof historyActions, value: number) => options.find(option => option.value === value)?.label ?? 'Other'
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function fail(): never { throw new PowerPagesDataError('Activity history could not be processed. Please try again.') }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(); return value as Record<string, unknown> }
function text(value: unknown, max: number): string { if (typeof value !== 'string' || value.length > max) return fail(); return value }
function integer(value: unknown, min = 0): number { if (!Number.isSafeInteger(value) || (value as number) < min) return fail(); return value as number }
function guid(value: unknown): string { const result = text(value, 36); if (!guidPattern.test(result)) return fail(); return result }
function instant(value: unknown): string { const result = text(value, 40); if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,7})?Z$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 19) !== result.slice(0, 19)) return fail(); return result }
function scope(value: unknown): HistoryScope { if (value !== 'mine' && value !== 'all') return fail(); return value }
function entry(value: unknown): HistoryEntry { const row = object(value); return { id: guid(row.id), actorName: text(row.actorName, 100), action: integer(row.action), module: integer(row.module), recordType: text(row.recordType, 100), recordId: text(row.recordId, 100), recordTitle: text(row.recordTitle, 100), occurredOn: instant(row.occurredOn), summary: text(row.summary, 1000) } }
const messages: Record<string, string> = { unauthenticated: 'Please sign in to view your activity history.', forbidden: 'You do not have access to this activity history.', not_found: 'This activity entry is no longer available.', validation: 'Check the activity history filters and try again.', unavailable: 'Activity history is temporarily unavailable. Please try again.' }
export function historyError(error: unknown): string { return error instanceof Error && Object.values(messages).includes(error.message) ? error.message : messages.unavailable }
async function request(command: string, payload: unknown): Promise<Record<string, unknown>> {
 let raw: unknown = await powerPagesFetch('/_api/serverlogics/site-activity-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command, payload }) })
 try { if (typeof raw === 'string') raw = JSON.parse(raw); let body = object(raw); if ('success' in body) { if (body.success !== true) return fail(); body = object(typeof body.data === 'string' ? JSON.parse(body.data) : body.data) } if (body.ok === false) throw new Error(messages[String(object(body.error).code)] ?? messages.unavailable); if (body.ok !== true) return fail(); return body } catch (error) { if (error instanceof SyntaxError) return fail(); throw error }
}
export async function listSiteActivity(query: HistoryQuery): Promise<HistoryPage> {
 const payload: HistoryQuery = { scope: scope(query.scope), page: integer(query.page, 1), module: query.module, action: query.action, from: query.from === null ? null : instant(query.from), to: query.to === null ? null : instant(query.to) }
 if (payload.module !== null && !historyModules.some(item => item.value === payload.module) || payload.action !== null && !historyActions.some(item => item.value === payload.action) || payload.from && payload.to && Date.parse(payload.from) >= Date.parse(payload.to)) return fail()
 const body = await request('list', payload)
 if (!Array.isArray(body.entries) || body.entries.length > 25 || typeof body.canViewAll !== 'boolean') return fail()
 return { entries: body.entries.map(entry), nextPage: body.nextPage === null ? null : integer(body.nextPage, payload.page + 1), totalCount: body.totalCount === null ? null : integer(body.totalCount), canViewAll: body.canViewAll }
}
export async function getSiteActivity(id: string, requestedScope: HistoryScope): Promise<HistoryDetail> {
 const body = await request('detail', { id: guid(id), scope: scope(requestedScope) }); const row = object(body.entry); const details = object(row.details)
 if (JSON.stringify(details).length > 4000) return fail()
 const result = entry(row); if (result.id.toLowerCase() !== id.toLowerCase()) return fail()
 return { ...result, details }
}


