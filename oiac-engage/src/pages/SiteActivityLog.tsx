import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import ContentCard from '../components/ContentCard'
import PageHeader from '../components/PageHeader'
import { getSiteActivity, historyActions, historyError, historyLabel, historyModules, listSiteActivity, type HistoryDetail, type HistoryEntry, type HistoryQuery } from '../features/siteActivityLog/siteActivityLogService'
import { formatHistoryDetails } from '../features/siteActivityLog/historyDetails'
import { historyEasternDateRange } from '../features/siteActivityLog/historyDates'
import '../features/siteActivityLog/siteActivityLog.css'
const initialQuery: HistoryQuery = { scope: 'mine', page: 1, module: null, action: null, from: null, to: null }
export default function SiteActivityLog({ isAdmin = false }: { isAdmin?: boolean }) {
 const [query, setQuery] = useState(initialQuery)
 const [rows, setRows] = useState<HistoryEntry[]>([])
 const [nextPage, setNextPage] = useState<number | null>(null)
 const [canViewAll, setCanViewAll] = useState(false)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [failedQuery, setFailedQuery] = useState<HistoryQuery | null>(null)
 const [detail, setDetail] = useState<HistoryDetail | null>(null)
 const [detailError, setDetailError] = useState('')
 const [detailBusy, setDetailBusy] = useState<string | null>(null)
 const [expanded, setExpanded] = useState<string | null>(null)
 const generation = useRef(0)
 const detailGeneration = useRef(0)
 useEffect(() => { document.title = 'Activity Log - OIAC Engage'; return () => { generation.current++; detailGeneration.current++ } }, [])
 async function load(request: HistoryQuery) {
  const current = ++generation.current
  setBusy(true); setError(''); setFailedQuery(null)
  try {
   const result = await listSiteActivity(request)
   if (current !== generation.current) return
   setRows(previous => { const all = request.page === 1 ? result.entries : [...previous, ...result.entries]; return all.filter((row, index) => all.findIndex(item => item.id === row.id) === index) })
   setQuery(request); setNextPage(result.nextPage); setCanViewAll(result.canViewAll)
   if (request.page === 1) { setExpanded(null); setDetail(null); detailGeneration.current++ }
  } catch (cause) { if (current === generation.current) { setError(historyError(cause)); setFailedQuery(request) } }
  finally { if (current === generation.current) setBusy(false) }
 }
 useEffect(() => { void load(initialQuery) }, [])
 function apply(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); const data = new FormData(event.currentTarget)
  const from = String(data.get('from') || ''); const to = String(data.get('to') || '')
  if (from && to && from > to) { setError('From date must be on or before To date.'); setFailedQuery(null); return }
  let range: { from: string | null; to: string | null }
  try { range = historyEasternDateRange(from, to) } catch { setError('Choose a valid Eastern date range.'); setFailedQuery(null); return }
  void load({ scope: data.get('scope') === 'all' && isAdmin && canViewAll ? 'all' : 'mine', page: 1, module: data.get('module') ? Number(data.get('module')) : null, action: data.get('action') ? Number(data.get('action')) : null, ...range })
 }
 async function showDetails(row: HistoryEntry) {
  if (expanded === row.id) { setExpanded(null); detailGeneration.current++; return }
  const current = ++detailGeneration.current
  setExpanded(row.id); setDetail(null); setDetailError(''); setDetailBusy(row.id)
  try { const result = await getSiteActivity(row.id, query.scope); if (current === detailGeneration.current) setDetail(result) }
  catch (cause) { if (current === detailGeneration.current) setDetailError(historyError(cause)) }
  finally { if (current === detailGeneration.current) setDetailBusy(null) }
 }
 return <div className="page page--site-activity-log">
  <PageHeader eyebrow="Your records" title="Activity Log" description="Review actions performed on OIAC Engage. Your own activity is shown by default." />
  <ContentCard title="Activity history">
   <form className="history-filters" hidden onSubmit={apply}>
    {isAdmin && canViewAll && <label>History scope<select name="scope" defaultValue="mine"><option value="mine">My activity</option><option value="all">All users</option></select></label>}
    <label>Module<select name="module"><option value="">All modules</option>{historyModules.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label>Action<select name="action"><option value="">All actions</option>{historyActions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label>From date (Eastern)<input type="date" name="from" /></label><label>To date (Eastern)<input type="date" name="to" /></label>
    <button className="button button--primary" disabled={busy} type="submit">Apply filters</button>
   </form>
   {error && <div role="alert"><p>{error}</p>{failedQuery && <button className="button button--quiet" onClick={() => void load(failedQuery)} disabled={busy}>Retry</button>}</div>}
   {busy && <p role="status">Loading activity history...</p>}
   {!busy && !error && rows.length === 0 && <p>No activity history yet.</p>}
   {rows.length > 0 && <div className="press-coverage-table-scroll history-table-scroll" role="region" aria-label="Activity history table, scroll horizontally" tabIndex={0}><table className="press-coverage-table history-table"><caption className="sr-only">Activity history, newest first</caption><thead><tr>{['Summary', 'Module', 'Action', 'User', 'Date & Time (Eastern)', 'Details'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row => <Fragment key={row.id}><tr>
    <th scope="row">{row.summary}</th><td>{historyLabel(historyModules, row.module)}</td><td>{historyLabel(historyActions, row.action)}</td><td>{row.actorName}</td><td><time dateTime={row.occurredOn}>{new Date(row.occurredOn).toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })}</time></td><td><button className="press-coverage-table__edit history-detail-action" aria-expanded={expanded === row.id} aria-controls={`history-detail-${row.id}`} aria-label={`${expanded === row.id ? 'Hide' : 'View'} details for ${row.recordTitle || 'Record'}`} onClick={() => void showDetails(row)}>Details</button></td>
   </tr>{expanded === row.id && <tr><td colSpan={6}><section id={`history-detail-${row.id}`} aria-label={`Details for ${row.recordTitle || 'Record'}`}>
    {detailBusy === row.id && <p role="status">Loading details...</p>}{detailError && <p role="alert">{detailError}</p>}{detail && <><h3>Activity details</h3><dl><dt>Record</dt><dd>{detail.recordTitle || 'Record'}</dd><dt>Occurred on (UTC)</dt><dd><time dateTime={detail.occurredOn}>{detail.occurredOn}</time></dd></dl>{formatHistoryDetails(detail.module, detail.details).length ? <dl>{formatHistoryDetails(detail.module, detail.details).map(([key, value]) => <Fragment key={key}><dt>{key}</dt><dd>{value}</dd></Fragment>)}</dl> : <p>No additional details are available.</p>}</>}
   </section></td></tr>}</Fragment>)}</tbody></table></div>}
   {nextPage !== null && !failedQuery && <button className="button button--quiet" disabled={busy} onClick={() => void load({ ...query, page: nextPage })}>Load more</button>}
  </ContentCard>
 </div>
}

