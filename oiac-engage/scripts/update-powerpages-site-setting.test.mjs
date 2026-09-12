import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { updateSiteSetting } from './update-powerpages-site-setting.mjs'

const SETTING_ID = '6dcbad52-ea17-47a3-ae96-d2854e9d30d8'
const SETTING_NAME = 'Webapi/contact/fields'

function withFixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'oiac-site-setting-'))
  const filePath = join(directory, 'Webapi-contact-fields.sitesetting.yml')
  writeFileSync(filePath, [
    'value: old',
    `name: ${SETTING_NAME}`,
    `id: ${SETTING_ID}`,
    'description: Existing description',
    '',
  ].join('\n'), 'utf8')
  try {
    return run({ directory, filePath })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('updates only the value and emits deterministic sorted YAML', () => {
  withFixture(({ filePath }) => {
    const result = updateSiteSetting({
      filePath,
      expectedName: SETTING_NAME,
      expectedId: SETTING_ID,
      value: 'contactid,firstname,address1_postalcode',
    })

    assert.deepEqual(result, { filePath })
    assert.equal(readFileSync(filePath, 'utf8'), [
      'description: Existing description',
      `id: ${SETTING_ID}`,
      `name: ${SETTING_NAME}`,
      'value: "contactid,firstname,address1_postalcode"',
      '',
    ].join('\n'))
  })
})

test('rejects a mismatched setting name or id without changing the file', () => {
  withFixture(({ filePath }) => {
    const original = readFileSync(filePath, 'utf8')
    assert.throws(() => updateSiteSetting({
      filePath,
      expectedName: 'Webapi/account/fields',
      expectedId: SETTING_ID,
      value: 'contactid',
    }), /name does not match/i)
    assert.throws(() => updateSiteSetting({
      filePath,
      expectedName: SETTING_NAME,
      expectedId: '11111111-1111-4111-8111-111111111111',
      value: 'contactid',
    }), /id does not match/i)
    assert.equal(readFileSync(filePath, 'utf8'), original)
  })
})

test('rejects missing files, duplicate keys, and unsupported multiline values', () => {
  withFixture(({ directory, filePath }) => {
    assert.throws(() => updateSiteSetting({
      filePath: join(directory, 'missing.sitesetting.yml'),
      expectedName: SETTING_NAME,
      expectedId: SETTING_ID,
      value: 'contactid',
    }), /does not exist/i)

    writeFileSync(filePath, [
      `id: ${SETTING_ID}`,
      `name: ${SETTING_NAME}`,
      'value: first',
      'value: second',
      '',
    ].join('\n'), 'utf8')
    assert.throws(() => updateSiteSetting({
      filePath,
      expectedName: SETTING_NAME,
      expectedId: SETTING_ID,
      value: 'contactid',
    }), /duplicate key/i)

    assert.throws(() => updateSiteSetting({
      filePath,
      expectedName: SETTING_NAME,
      expectedId: SETTING_ID,
      value: 'contactid\nfirstname',
    }), /single-line/i)
  })
})

test('provides a CLI that updates the setting and returns its path as JSON', () => {
  withFixture(({ filePath }) => {
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL('./update-powerpages-site-setting.mjs', import.meta.url)),
      '--filePath', filePath,
      '--expectedName', SETTING_NAME,
      '--expectedId', SETTING_ID,
      '--value', 'contactid,firstname',
    ], { encoding: 'utf8' })

    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), { filePath })
  })
})
