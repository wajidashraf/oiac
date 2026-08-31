/// <reference types="vite/client" />

import { expect, test } from 'vitest'
import css from './theme.css?raw'

function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = hex.match(/[a-f\d]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? []
    const [red, green, blue] = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)
  }
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

test('keeps the anonymous hero at the requested desktop dimensions', () => {
  expect(css).toContain('--anonymous-hero-height: 31.25rem')
  expect(css).toMatch(/\.anonymous-main\s*\{[^}]*padding-top:\s*2\.5rem/s)
  expect(css).toMatch(/\.anonymous-hero\s*\{[^}]*height:\s*var\(--anonymous-hero-height\)/s)
})

test('uses neutral link defaults without hover underlines or color shifts', () => {
  expect(css).toMatch(/a\s*\{[^}]*color:\s*inherit[^}]*text-decoration:\s*none/s)
  expect(css).toMatch(/a:hover\s*\{[^}]*color:\s*inherit[^}]*text-decoration:\s*none/s)
})

test('normalizes table and record rows to the submissions-table rhythm', () => {
  expect(css).toContain('--dashboard-row-height: 3.5rem')
  expect(css).toMatch(/\.dashboard-table\s+tr\s*\{[^}]*height:\s*var\(--dashboard-row-height\)/s)
  expect(css).toMatch(/\.record-list__item\s*\{[^}]*min-height:\s*var\(--dashboard-row-height\)/s)
})

test('uses one bootstrap-style container width and gutter across the portal shell', () => {
  expect(css).toContain('--site-container-max: 81.5rem')
  expect(css).toContain('--site-container-gutter: clamp(1rem, 2.5vw, 2rem)')
  expect(css).toMatch(/\.site-container\s*\{[^}]*width:\s*min\(var\(--site-container-max\),\s*calc\(100%\s*-\s*\(2\s*\*\s*var\(--site-container-gutter\)\)\)\)/s)
})

test('keeps tablet grids distinct from the stacked mobile layout', () => {
  expect(css).toMatch(/@media \(max-width:\s*64rem\)\s*\{[\s\S]*?\.quick-links,\s*\.dashboard-grid,\s*\.card-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  expect(css).toMatch(/@media \(max-width:\s*47\.99rem\)\s*\{[\s\S]*?\.quick-links,\s*\.dashboard-grid,\s*\.card-grid\s*\{[^}]*grid-template-columns:\s*1fr/)
})

test('prevents root overflow while preserving mobile table scrollers', () => {
  expect(css).toMatch(/html,\s*body\s*\{[^}]*overflow-x:\s*clip/)
  expect(css).toMatch(/\.contact-directory__table-scroll\s*\{[^}]*overflow-x:\s*auto/)
  expect(css).toMatch(/\.press-coverage-table-scroll\s*\{[^}]*overflow-x:\s*auto/)
})

test('uses compact desktop navigation and touch-sized responsive controls', () => {
  expect(css).toMatch(/\.portal-nav__link\s*\{[^}]*min-height:\s*2\.25rem/)
  expect(css).toMatch(/@media \(max-width:\s*64rem\)\s*\{[\s\S]*?\.portal-nav__link\s*\{[^}]*min-height:\s*2\.75rem/)
  expect(css).toMatch(/@media \(max-width:\s*47\.99rem\)\s*\{[\s\S]*?\.site-brand__wordmark\s*\{[^}]*display:\s*none/)
})

test('keeps neutral press sentiment text at WCAG AA contrast', () => {
  const color = css.match(/\.press-coverage-table__sentiment--neutral\s*\{[^}]*color:\s*(#[a-f\d]{6})/i)?.[1]

  expect(color).toBeDefined()
  expect(contrastRatio(color!, '#ffffff')).toBeGreaterThanOrEqual(4.5)
})

test('isolates Contacts controls from Power Pages and Bootstrap defaults', () => {
  const searchControl = css.match(/\.page--contacts \.contact-directory__search input\s*\{([^}]*)\}/s)?.[1]
  const paginationControl = css.match(/\.page--contacts \.contact-directory__pagination button\s*\{([^}]*)\}/s)?.[1]

  expect(searchControl).toContain('appearance: none')
  expect(searchControl).toContain('font-family: var(--font-body)')
  expect(searchControl).toContain('border:')
  expect(paginationControl).toContain('appearance: none')
  expect(paginationControl).toContain('font-family: var(--font-body)')
  expect(paginationControl).toContain('border:')
  expect(css).not.toContain('.contact-directory__view')
  expect(css).not.toContain('.contact-directory__viewer')
})

test('reduces only My Reports rows by approximately ten percent', () => {
  expect(css).toContain('--my-reports-row-height: 3.15rem')
  expect(css).toMatch(/\.page--my-reports \.record-list__item\s*\{[^}]*min-height:\s*var\(--my-reports-row-height\)[^}]*padding:\s*0\.5625rem 0/s)
})

test('isolates Events controls and cards from Power Pages defaults', () => {
  const eventsCss = css.match(/\/\* Events page \*\/([\s\S]*?)\/\* End Events page \*\//)?.[1]

  expect(eventsCss).toBeDefined()
  expect(eventsCss).not.toContain('!important')
  expect(eventsCss).toMatch(/\.oiac-events-page \.oiac-events-page__filters button\s*\{[^}]*appearance:\s*none[^}]*font-family:\s*var\(--font-body\)[^}]*border:/s)
  expect(eventsCss).toMatch(/\.oiac-events-page \.oiac-event-card__actions button\s*\{[^}]*appearance:\s*none[^}]*background:\s*#[a-f\d]{6}[^}]*line-height:/i)
  expect(eventsCss).toMatch(/\.oiac-events-page \.oiac-events-page__grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s)
})

test('stacks Events cards at the phone breakpoint without widening the page', () => {
  expect(css).toMatch(/@media \(max-width:\s*47\.99rem\)\s*\{[\s\S]*?\.oiac-events-page \.oiac-events-page__grid\s*\{[^}]*grid-template-columns:\s*1fr/s)
  expect(css).toMatch(/\.oiac-events-page \.oiac-month-calendar\s*\{[^}]*overflow-x:\s*auto/s)
})

test('keeps Events supporting text at WCAG AA contrast', () => {
  const mutedColor = css.match(/\.oiac-events-page\s*\{[^}]*--calendar-muted:\s*(#[a-f\d]{6})/i)?.[1]

  expect(mutedColor).toBeDefined()
  expect(contrastRatio(mutedColor!, '#ffffff')).toBeGreaterThanOrEqual(4.5)
})

test('uses explicit, targeted disabled styling for Coming Soon features', () => {
  expect(css).toContain('.portal-nav__link--coming-soon')
  expect(css).toContain('.dashboard-shortcut--coming-soon')
  expect(css).toContain('.dashboard-panel--coming-soon')
  expect(css).toContain('.dashboard-section--coming-soon')
  expect(css).not.toContain(':has(.coming-soon-badge)')
})
