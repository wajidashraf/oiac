import type { ActivityAuthor, ActivityComment } from './activityTypes'
export function safeActivityUrl(value: string): string | null {
  if (/[\u0000-\u0020\u007f\\]/.test(value)) return null
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.hostname ? url.href : null } catch { return null }
}
export function ActivityText({ content }: { content: string }) {
  return <div className="ac-text">{content.split(/\n\s*\n/).map((paragraph, p) => <p key={p}>{paragraph.split(/(https?:\/\/[^\s<>]+)/gi).map((part, i) => {
    const href = /^https?:\/\//i.test(part) ? safeActivityUrl(part) : null
    return href ? <a key={i} href={href} target="_blank" rel="noopener noreferrer">{part}</a> : part
  })}</p>)}</div>
}
export function ActivityIdentity({ author }: { author: ActivityAuthor }) {
  return <><span className="ac-avatar" aria-hidden="true">{author.name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase()}</span><div className="ac-identity"><strong>{author.name}</strong>{author.jobTitle && <span>{author.jobTitle}</span>}</div></>
}
export function ActivityTime({ value }: { value: string }) {
  const date = new Date(value); const now = new Date()
  const label = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date)
  const calendarDay = (input: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(input)
    const number = (type: string) => Number(parts.find(p => p.type === type)?.value)
    return Date.UTC(number('year'), number('month') - 1, number('day'))
  }
  const age = now.getTime() - date.getTime(); const days = (calendarDay(now) - calendarDay(date)) / 86400000
  const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date)
  const display = age >= 0 && age < 60000 ? 'Just now' : days === 0 ? `Today, ${clock}` : days === 1 ? `Yesterday, ${clock}` : label
  return <time dateTime={value} title={label}>{display}</time>
}
export function buildThread(comments: ActivityComment[]): { comment: ActivityComment; depth: number; missingContext: boolean }[] {
  const deduped = new Map(comments.map(c => [c.id, c]))
  const ordered = [...deduped.values()].sort((a, b) => (Date.parse(a.createdOn) - Date.parse(b.createdOn) || a.id.localeCompare(b.id)))
  const byId = new Map(ordered.map(c => [c.id, c])); const children = new Map<string, ActivityComment[]>()
  for (const c of byId.values()) if (c.parentId && byId.has(c.parentId)) children.set(c.parentId, [...(children.get(c.parentId) ?? []), c])
  const rows: { comment: ActivityComment; depth: number; missingContext: boolean }[] = []; const visited = new Set<string>()
  function walk(root: ActivityComment, missingContext: boolean) {
    const stack = [{ comment: root, depth: root.parentId ? 1 : 0, missingContext }]
    while (stack.length) { const row = stack.pop()!; if (visited.has(row.comment.id)) continue; visited.add(row.comment.id); rows.push(row)
      for (const child of [...(children.get(row.comment.id) ?? [])].reverse()) stack.push({ comment: child, depth: 1, missingContext: false })
    }
  }
  for (const c of byId.values()) if (!c.parentId || !byId.has(c.parentId)) walk(c, !!c.parentId)
  for (const c of byId.values()) if (!visited.has(c.id)) walk(c, true)
  return rows
}
