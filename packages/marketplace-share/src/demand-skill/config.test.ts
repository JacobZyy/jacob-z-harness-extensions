import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadConfig, loadConfigFile, saveConfigFile } from './config'

describe('loadConfig', () => {
  it('returns defaults when no env vars set', () => {
    delete process.env.DEMAND_TAPD_API_BASE
    delete process.env.DEMAND_CONFIG_PATH
    const config = loadConfig()
    expect(config.tapdApiBase).toBe('http://api.zhuaninc.com/api/tapd_open_api')
    expect(config.configPath).toContain('.config/demand-skill/config.json')
  })

  it('reads DEMAND_TAPD_API_BASE from env', () => {
    process.env.DEMAND_TAPD_API_BASE = 'http://custom-api.example.com'
    const config = loadConfig()
    expect(config.tapdApiBase).toBe('http://custom-api.example.com')
    delete process.env.DEMAND_TAPD_API_BASE
  })

  it('reads DEMAND_CONFIG_PATH from env', () => {
    process.env.DEMAND_CONFIG_PATH = '/tmp/test-config.json'
    const config = loadConfig()
    expect(config.configPath).toBe('/tmp/test-config.json')
    delete process.env.DEMAND_CONFIG_PATH
  })
})

describe('loadConfigFile', () => {
  const testDir = join(tmpdir(), `demand-test-${Date.now()}`)

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true })
    }
    catch {}
  })

  it('returns empty object for missing file', () => {
    expect(loadConfigFile(join(testDir, 'nonexistent.json'))).toEqual({})
  })

  it('parses valid JSON', () => {
    const filePath = join(testDir, 'config.json')
    mkdirSync(testDir, { recursive: true })
    writeFileSync(filePath, JSON.stringify({ key: 'value' }))
    expect(loadConfigFile(filePath)).toEqual({ key: 'value' })
  })

  it('returns empty object for invalid JSON', () => {
    const filePath = join(testDir, 'bad.json')
    mkdirSync(testDir, { recursive: true })
    writeFileSync(filePath, 'not json')
    expect(loadConfigFile(filePath)).toEqual({})
  })
})

describe('saveConfigFile', () => {
  const testDir = join(tmpdir(), `demand-test-save-${Date.now()}`)

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true })
    }
    catch {}
  })

  it('creates directory and writes JSON', () => {
    const filePath = join(testDir, 'sub', 'config.json')
    saveConfigFile(filePath, { token: 'abc' })
    const content = JSON.parse(readFileSync(filePath, 'utf-8'))
    expect(content).toEqual({ token: 'abc' })
  })
})
