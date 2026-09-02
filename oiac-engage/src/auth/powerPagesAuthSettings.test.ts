/// <reference types="vite/client" />

import { describe, expect, test } from 'vitest'
import azureAdLogin from '../../.powerpages-site/site-settings/Authentication-Registration-AzureADLoginEnabled.sitesetting.yml?raw'
import captchaEnabled from '../../.powerpages-site/site-settings/Authentication-Registration-CaptchaEnabled.sitesetting.yml?raw'
import registrationEnabled from '../../.powerpages-site/site-settings/Authentication-Registration-Enabled.sitesetting.yml?raw'
import externalLogin from '../../.powerpages-site/site-settings/Authentication-Registration-ExternalLoginEnabled.sitesetting.yml?raw'
import invitationEnabled from '../../.powerpages-site/site-settings/Authentication-Registration-InvitationEnabled.sitesetting.yml?raw'
import localLogin from '../../.powerpages-site/site-settings/Authentication-Registration-LocalLoginEnabled.sitesetting.yml?raw'
import openRegistration from '../../.powerpages-site/site-settings/Authentication-Registration-OpenRegistrationEnabled.sitesetting.yml?raw'
import profileRedirect from '../../.powerpages-site/site-settings/Authentication-Registration-ProfileRedirectEnabled.sitesetting.yml?raw'

const siteSettings = import.meta.glob('../../.powerpages-site/site-settings/*.sitesetting.yml', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

const resetPasswordEnabled = siteSettings[
  '../../.powerpages-site/site-settings/Authentication-Registration-ResetPasswordEnabled.sitesetting.yml'
]

function settingValue(yaml: string): string | undefined {
  return yaml.match(/^value:\s*(.+)$/m)?.[1]?.trim()
}

describe('Power Pages authentication settings', () => {
  test('keeps open local registration enabled without invitation registration', () => {
    expect(settingValue(registrationEnabled)).toBe('true')
    expect(settingValue(invitationEnabled)).toBe('false')
    expect(settingValue(localLogin)).toBe('true')
    expect(settingValue(openRegistration)).toBe('true')
  })

  test('keeps registration CAPTCHA explicitly disabled', () => {
    expect(settingValue(captchaEnabled)).toBe('false')
  })

  test('disables external identity providers', () => {
    expect(settingValue(externalLogin)).toBe('false')
    expect(settingValue(azureAdLogin)).toBe('false')
  })

  test('returns authenticated users to the SPA instead of the legacy profile page', () => {
    expect(settingValue(profileRedirect)).toBe('false')
  })

  test('explicitly enables native password reset', () => {
    expect(resetPasswordEnabled).toBeDefined()
    expect(settingValue(resetPasswordEnabled!)).toBe('true')
  })
})
