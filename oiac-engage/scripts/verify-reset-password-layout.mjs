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
          <div class="page-content">
            <div class="row"><div class="col-md-12">
              <form action="/Account/Login/ResetPassword" method="post">
                <input name="__RequestVerificationToken" type="hidden" value="fixture-token">
                <input id="UserId" name="UserId" type="hidden" value="fixture-user">
                <input id="Code" name="Code" type="hidden" value="fixture-code">
                <div><fieldset>
                  <legend>Reset password</legend>
                  <div class="validation-summary-valid alert alert-block alert-danger"><ul><li style="display:none"></li></ul></div>
                  <div class="row mb-3">
                    <label class="col-md-4 col-form-label fw-bold" for="Password">New password</label>
                    <div class="col-md-8"><input class="form-control" id="Password" name="Password" type="password"></div>
                  </div>
                  <div class="row mb-3">
                    <label class="col-md-4 col-form-label fw-bold" for="ConfirmPassword">Confirm new password</label>
                    <div class="col-md-8"><input class="form-control" id="ConfirmPassword" name="ConfirmPassword" type="password"></div>
                  </div>
                  <div class="row mb-3"><div class="offset-md-4 col-md-8"><button id="submit-reset-password" class="btn btn-primary">Reset password</button></div></div>
                </fieldset></div>
              </form>
            </div></div>
          </div>
        </div>
      </div>
      <style>
        .container { width: 100% !important; max-width: 1140px !important; margin: 0 !important; float: left !important; }
        .row { display: flex !important; margin-inline: -0.75rem !important; }
        .col-md-4 { width: 33.333333% !important; padding-inline: 0.75rem !important; }
        .col-md-8 { width: 66.666667% !important; padding-inline: 0.75rem !important; }
        .offset-md-4 { margin-left: 33.333333% !important; }
      </style>
    `)

    const layout = await page.evaluate(() => {
      const card = document.querySelector('fieldset')
      const fieldRow = document.querySelector('.row.mb-3')
      const field = fieldRow?.querySelector('.col-md-8')
      const input = document.querySelector('#Password')
      const button = document.querySelector('#submit-reset-password')
      if (!card || !fieldRow || !field || !input || !button) throw new Error('Reset fixture is incomplete.')

      const cardRect = card.getBoundingClientRect()
      return {
        cardWidth: cardRect.width,
        cardLeft: cardRect.left,
        fieldDisplay: getComputedStyle(fieldRow).display,
        fieldWidth: field.getBoundingClientRect().width,
        inputWidth: input.getBoundingClientRect().width,
        buttonWidth: button.getBoundingClientRect().width,
        buttonBackground: getComputedStyle(button).backgroundColor,
      }
    })

    const expectedCardWidth = viewport.width > 720 ? 500 : viewport.width - 24
    if (
      Math.abs(layout.cardWidth - expectedCardWidth) > 1
      || Math.abs(layout.cardLeft - ((viewport.width - expectedCardWidth) / 2)) > 1
      || layout.fieldDisplay !== 'block'
      || Math.abs(layout.inputWidth - layout.fieldWidth) > 1
      || Math.abs(layout.buttonWidth - layout.fieldWidth) > 1
      || layout.buttonBackground !== 'rgb(89, 110, 106)'
    ) {
      throw new Error(`${viewport.width}px reset layout failed: ${JSON.stringify(layout)}`)
    }

    console.log(`${viewport.width}px reset layout: ${layout.cardWidth}px centered card with full-width controls`)
    await page.close()
  }
} finally {
  await browser.close()
}
