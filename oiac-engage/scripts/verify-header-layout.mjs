import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const outputDirectory = fileURLToPath(new URL('../artifacts/header/', import.meta.url))
const viewports = [
  { name: 'desktop', width: 1600, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const server = await createServer({
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})

let browser

try {
  mkdirSync(outputDirectory, { recursive: true })
  await server.listen()
  const baseUrl = server.resolvedUrls?.local[0]
  if (!baseUrl) throw new Error('Vite did not provide a local header URL.')

  browser = await chromium.launch({ headless: true })

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto(new URL('/', baseUrl).toString(), { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)

    if (viewport.name === 'mobile') {
      await page.getByRole('button', { name: 'Menu' }).click()
      await page.getByRole('navigation', { name: 'Primary navigation' }).waitFor({ state: 'visible' })
    }

    const hostileStyle = await page.addStyleTag({
      content: `
        body header { display: block; background: rgb(255, 0, 0); padding: 20px; }
        body nav { display: block; width: 10px; background: rgb(255, 0, 0); padding: 20px; }
        body a, body button { min-height: 60px; background: rgb(255, 0, 0); border: 4px solid rgb(255, 0, 0); color: white; font: 20px/2 Georgia, serif; padding: 20px; }
      `,
    })

    const metrics = await page.evaluate(() => {
      const header = document.querySelector('.site-header')
      const headerInner = document.querySelector('.site-header__inner')
      const brand = document.querySelector('.site-brand')
      const items = document.querySelector('.portal-nav__items')
      const links = document.querySelector('.portal-nav__links')
      const account = document.querySelector('.portal-nav__account')
      const firstLink = document.querySelector('.portal-nav__links .portal-nav__link')
      const activeLink = document.querySelector('.portal-nav__link--active')
      const menuToggle = document.querySelector('.portal-nav__menu-toggle')
      if (!header || !headerInner || !brand || !items || !links || !account || !firstLink || !activeLink || !menuToggle) {
        throw new Error('Header zones are missing.')
      }

      const brandRect = brand.getBoundingClientRect()
      const itemsRect = items.getBoundingClientRect()
      const linksRect = links.getBoundingClientRect()
      const accountRect = account.getBoundingClientRect()
      const itemsStyle = getComputedStyle(items)
      const columnGap = Number.parseFloat(itemsStyle.columnGap)
      const navZoneRight = accountRect.left - columnGap
      const navZoneCenter = itemsRect.left + ((navZoneRight - itemsRect.left) / 2)
      const linksCenter = linksRect.left + (linksRect.width / 2)
      const linkStyle = getComputedStyle(firstLink)
      const menuStyle = getComputedStyle(menuToggle)

      return {
        accountWidth: accountRect.width,
        activeBackground: getComputedStyle(activeLink).backgroundColor,
        brandWidth: brandRect.width,
        columnGap,
        headerBackground: getComputedStyle(header).backgroundColor,
        headerDisplay: getComputedStyle(headerInner).display,
        itemDisplay: getComputedStyle(items).display,
        linksDisplay: getComputedStyle(links).display,
        linksJustification: getComputedStyle(links).justifyContent,
        linksWidth: linksRect.width,
        navCenterOffset: Math.abs(linksCenter - navZoneCenter),
        linkFontFamily: linkStyle.fontFamily,
        linkMinHeight: Number.parseFloat(linkStyle.minHeight),
        linkPaddingTop: linkStyle.paddingTop,
        menuFontFamily: menuStyle.fontFamily,
        menuPaddingTop: menuStyle.paddingTop,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })

    if (metrics.pageOverflow > 1) throw new Error(`${viewport.name}: page overflows by ${metrics.pageOverflow}px`)
    if (metrics.activeBackground !== 'rgb(238, 241, 240)') {
      throw new Error(`${viewport.name}: active navigation state is not visible: ${JSON.stringify(metrics)}`)
    }
    if (metrics.headerBackground === 'rgb(255, 0, 0)' || metrics.linkFontFamily.startsWith('Georgia') || metrics.linkPaddingTop === '20px' || metrics.menuFontFamily.startsWith('Georgia') || metrics.menuPaddingTop === '20px') {
      throw new Error(`${viewport.name}: global platform styles overrode the header: ${JSON.stringify(metrics)}`)
    }

    if (viewport.name === 'desktop') {
      if (metrics.headerDisplay !== 'grid' || metrics.itemDisplay !== 'grid' || metrics.linksDisplay !== 'flex') {
        throw new Error(`desktop: header zones are not grid/flex aligned: ${JSON.stringify(metrics)}`)
      }
      if (metrics.linksJustification !== 'space-between' || metrics.navCenterOffset > 1) {
        throw new Error(`desktop: navigation is not centered with spaced links: ${JSON.stringify(metrics)}`)
      }
      if (metrics.linksWidth <= metrics.brandWidth || metrics.linksWidth <= metrics.accountWidth || metrics.linkMinHeight !== 36) {
        throw new Error(`desktop: zone sizing changed: ${JSON.stringify(metrics)}`)
      }
    } else if (metrics.linksDisplay !== 'grid' || metrics.linkMinHeight < 44) {
      throw new Error(`mobile: responsive navigation is not touch-sized: ${JSON.stringify(metrics)}`)
    }

    const accessibility = await new AxeBuilder({ page })
      .include('.site-header')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    if (accessibility.violations.length > 0) {
      const summary = accessibility.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.flatMap((node) => node.target),
      }))
      throw new Error(`${viewport.name}: header accessibility violations: ${JSON.stringify(summary)}`)
    }

    await hostileStyle.evaluate((style) => style.remove())
    await page.screenshot({ path: `${outputDirectory}${viewport.name}.png`, fullPage: false })
    console.log(`${viewport.name} header: ${JSON.stringify(metrics)}`)
    await context.close()
  }
} finally {
  await browser?.close()
  await server.close()
}
