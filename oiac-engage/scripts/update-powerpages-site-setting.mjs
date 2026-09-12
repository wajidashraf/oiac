#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE_SETTING_SUFFIX = '.sitesetting.yml'

function needsQuoting(value) {
  if (value === '' || value === 'true' || value === 'false' || value === 'null') return true
  if (value !== value.trim()) return true
  if (/[:#{}[\],&*?|<>=!%@`]/.test(value)) return true
  const first = value.charAt(0)
  return first === '-' || first === "'" || first === '"' || first === '\t'
}

function yamlValue(value) {
  if (!needsQuoting(value)) return value
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function parseScalar(rawValue, key) {
  if (rawValue.startsWith('"')) {
    try {
      const parsed = JSON.parse(rawValue)
      if (typeof parsed !== 'string') throw new Error()
      return parsed
    } catch {
      throw new Error(`Site setting key "${key}" contains an invalid quoted scalar.`)
    }
  }
  if (rawValue.startsWith("'")) {
    if (!rawValue.endsWith("'") || rawValue.length < 2) {
      throw new Error(`Site setting key "${key}" contains an invalid quoted scalar.`)
    }
    return rawValue.slice(1, -1).replace(/''/g, "'")
  }
  return rawValue
}

function parseSingleLineYaml(content) {
  const fields = new Map()
  for (const line of content.replace(/\r\n/g, '\n').split('\n')) {
    if (line === '') continue
    const match = /^([A-Za-z0-9_]+):(?: (.*))?$/.exec(line)
    if (!match) throw new Error('Site setting YAML must contain only single-line key/value entries.')
    const [, key, rawValue = ''] = match
    if (fields.has(key)) throw new Error(`Site setting YAML contains duplicate key "${key}".`)
    fields.set(key, parseScalar(rawValue, key))
  }
  return fields
}

export function updateSiteSetting({ filePath, expectedName, expectedId, value }) {
  if (typeof value !== 'string' || /[\r\n]/.test(value)) {
    throw new Error('The site setting value must be a single-line string.')
  }
  if (!filePath || !expectedName || !expectedId) {
    throw new Error('filePath, expectedName, and expectedId are required.')
  }

  const resolvedPath = resolve(filePath)
  if (!resolvedPath.toLowerCase().endsWith(SITE_SETTING_SUFFIX)) {
    throw new Error(`Site setting path must end with ${SITE_SETTING_SUFFIX}.`)
  }
  if (!existsSync(resolvedPath)) throw new Error(`Site setting file does not exist: ${resolvedPath}`)

  const fields = parseSingleLineYaml(readFileSync(resolvedPath, 'utf8'))
  if (fields.get('name') !== expectedName) {
    throw new Error('The existing site setting name does not match expectedName.')
  }
  if (String(fields.get('id') ?? '').toLowerCase() !== expectedId.toLowerCase()) {
    throw new Error('The existing site setting id does not match expectedId.')
  }
  if (!fields.has('value')) throw new Error('The existing site setting does not contain a value key.')

  fields.set('value', value)
  const output = [...fields.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, fieldValue]) => `${key}: ${yamlValue(fieldValue)}`)
    .join('\n') + '\n'
  writeFileSync(resolvedPath, output, 'utf8')
  return { filePath: resolvedPath }
}

function getArgument(args, name) {
  const index = args.indexOf(`--${name}`)
  return index >= 0 && index + 1 < args.length ? args[index + 1] : null
}

function runCli() {
  const args = process.argv.slice(2)
  const options = {
    filePath: getArgument(args, 'filePath'),
    expectedName: getArgument(args, 'expectedName'),
    expectedId: getArgument(args, 'expectedId'),
    value: getArgument(args, 'value'),
  }
  if (Object.values(options).some((item) => item === null)) {
    throw new Error('Usage: node update-powerpages-site-setting.mjs --filePath <path> --expectedName <name> --expectedId <id> --value <value>')
  }
  process.stdout.write(JSON.stringify(updateSiteSetting(options)))
}

const isDirectExecution = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false

if (isDirectExecution) {
  try {
    runCli()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
