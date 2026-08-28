import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const css = readFileSync(new URL('../.powerpages-site/web-files/auth.css/auth.css', import.meta.url), 'utf8')
const browser = await chromium.launch({ headless: true })

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport })
    await page.setContent(`
      <style>${css}</style>
      <div id="content-container" class="container wrapper-body" role="main">
        <div id="content">
          <ul class="nav nav-tabs nav-account">
            <li class="nav-item"><a class="nav-link active" href="#">Sign in</a></li>
            <li class="nav-item"><a class="nav-link" href="#">Redeem invitation</a></li>
          </ul>
          <div class="page-content" id="mainContent">
            <div class="row">
              <div class="col-md-6">
                <form>
                  <div class="portal-form">
                    <h2 class="login-heading-section">Sign in with a local account</h2>
                    <div class="validation-summary-valid"></div>
                    <div class="row mb-3">
                      <label class="col-md-4 col-form-label required fw-bold" for="Username">Username</label>
                      <div class="col-md-8"><input class="form-control" id="Username"></div>
                    </div>
                    <div class="row mb-3">
                      <label class="col-md-4 col-form-label required fw-bold" for="PasswordValue">Password</label>
                      <div class="col-md-8"><input class="form-control" id="PasswordValue" type="password"></div>
                    </div>
                    <div class="row mb-3">
                      <div class="offset-md-4 col-md-8"><div class="checkbox"><label><input type="checkbox"> Remember me?</label></div></div>
                    </div>
                    <div class="row mb-3">
                      <div class="offset-md-4 col-md-8"><button class="btn btn-primary">Sign in</button><a class="btn btn-default" href="/Account/Login/ForgotPassword">Forgot your password?</a></div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>
        .container { width: 100% !important; max-width: 1140px !important; margin: 0 !important; float: left !important; }
        .row { display: flex !important; margin-inline: -0.75rem !important; }
        .col-md-6 { width: 50% !important; flex: 0 0 auto !important; padding-inline: 0.75rem !important; }
        .col-md-4 { width: 33.333333% !important; flex: 0 0 auto !important; padding-inline: 0.75rem !important; }
        .col-md-8 { width: 66.666667% !important; flex: 0 0 auto !important; padding-inline: 0.75rem !important; }
        .offset-md-4 { margin-left: 33.333333% !important; }
        .nav-link.active { border: 1px solid #dee2e6 !important; border-radius: 0.375rem !important; background: #fff !important; }
      </style>
    `)

    const layout = await page.evaluate(() => {
      const shell = document.querySelector('#content-container')
      const contentColumn = document.querySelector('#mainContent > .row > .col-md-6')
      const form = document.querySelector('.portal-form')
      const fieldRow = document.querySelector('.portal-form > .row')
      const fieldLabel = document.querySelector('.portal-form > .row .col-form-label')
      const activeTab = document.querySelector('.nav-account .nav-link.active')
      if (!shell || !contentColumn || !form || !fieldRow || !fieldLabel || !activeTab) throw new Error('Auth fixture is incomplete.')

      const shellRect = shell.getBoundingClientRect()
      const columnRect = contentColumn.getBoundingClientRect()
      const formRect = form.getBoundingClientRect()
      const shellStyle = getComputedStyle(shell)
      const rowStyle = getComputedStyle(fieldRow)
      const labelStyle = getComputedStyle(fieldLabel)
      const tabStyle = getComputedStyle(activeTab)

      return {
        shellWidth: shellRect.width,
        shellLeft: shellRect.left,
        shellFloat: shellStyle.float,
        columnWidth: columnRect.width,
        formWidth: formRect.width,
        formLeft: formRect.left,
        rowDisplay: rowStyle.display,
        rowColumns: rowStyle.gridTemplateColumns,
        labelAlign: labelStyle.textAlign,
        activeBorderBottomColor: tabStyle.borderBottomColor,
        activeBorderRadius: tabStyle.borderRadius,
      }
    })

    const expectedShellWidth = Math.min(672, viewport.width - (viewport.width <= 720 ? 24 : 32))
    const expectedShellLeft = (viewport.width - expectedShellWidth) / 2
    const expectedFormWidth = Math.min(500, expectedShellWidth)
    const expectedFormLeft = (viewport.width - expectedFormWidth) / 2

    if (
      Math.abs(layout.shellWidth - expectedShellWidth) > 0.5
      || Math.abs(layout.shellLeft - expectedShellLeft) > 0.5
      || layout.shellFloat !== 'none'
      || Math.abs(layout.columnWidth - expectedShellWidth) > 0.5
      || Math.abs(layout.formWidth - expectedFormWidth) > 0.5
      || Math.abs(layout.formLeft - expectedFormLeft) > 0.5
      || layout.rowDisplay !== 'grid'
      || (viewport.width > 720 && layout.rowColumns !== '112px 372px')
      || (viewport.width > 720 && layout.labelAlign !== 'right')
      || (viewport.width <= 720 && layout.labelAlign !== 'left')
      || layout.activeBorderBottomColor !== 'rgb(0, 120, 212)'
      || layout.activeBorderRadius !== '0px'
    ) {
      throw new Error(`${viewport.width}px auth layout failed: ${JSON.stringify(layout)}`)
    }

    console.log(`${viewport.width}px auth layout: ${layout.shellWidth}px shell, ${layout.formWidth}px form, Bootstrap rules overridden`)
    await page.close()
  }
} finally {
  await browser.close()
}
