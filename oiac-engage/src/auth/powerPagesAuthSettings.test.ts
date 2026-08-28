/// <reference types="vite/client" />

import { describe, expect, test } from 'vitest'
import azureAdLogin from '../../.powerpages-site/site-settings/Authentication-Registration-AzureADLoginEnabled.sitesetting.yml?raw'
import registrationEnabled from '../../.powerpages-site/site-settings/Authentication-Registration-Enabled.sitesetting.yml?raw'
import externalLogin from '../../.powerpages-site/site-settings/Authentication-Registration-ExternalLoginEnabled.sitesetting.yml?raw'
import invitationEnabled from '../../.powerpages-site/site-settings/Authentication-Registration-InvitationEnabled.sitesetting.yml?raw'
import localLogin from '../../.powerpages-site/site-settings/Authentication-Registration-LocalLoginEnabled.sitesetting.yml?raw'
import openRegistration from '../../.powerpages-site/site-settings/Authentication-Registration-OpenRegistrationEnabled.sitesetting.yml?raw'
import profileRedirect from '../../.powerpages-site/site-settings/Authentication-Registration-ProfileRedirectEnabled.sitesetting.yml?raw'

function settingValue(yaml: string): string | undefined {
  return yaml.match(/^value:\s*(.+)$/m)?.[1]?.trim()
}

describe('Power Pages authentication settings', () => {
  test('keeps invitation-only local registration enabled', () => {
    expect(settingValue(registrationEnabled)).toBe('true')
    expect(settingValue(invitationEnabled)).toBe('true')
    expect(settingValue(localLogin)).toBe('true')
    expect(settingValue(openRegistration)).toBe('false')
  })

  test('disables external identity providers', () => {
    expect(settingValue(externalLogin)).toBe('false')
    expect(settingValue(azureAdLogin)).toBe('false')
  })

  test('returns authenticated users to the SPA instead of the legacy profile page', () => {
    expect(settingValue(profileRedirect)).toBe('false')
  })
})
