import type { NormalizedOptions } from '../../src/core/types'

import { describe, expect, it } from 'vitest'
import { buildEslintArgs, runEslintForFile } from '../../src/adapters/eslint'

const baseOptions: NormalizedOptions = {
  linter: 'eslint',
  extensions: ['.ts'],
  maxLines: 2000,
  log: false,
  logPath: 'unused.log',
  maxHints: 3,
  mode: 'fix',
  ignore: [],
  oxlint: {
    bin: 'oxlint',
    configPath: undefined,
    disableNestedConfig: false,
    oxfmt: { bin: 'oxfmt', configPath: undefined, disableNestedConfig: false },
  },
  eslint: { bin: 'eslint', configPath: undefined },
}

describe('eslint adapter', () => {
  it('builds fix and check arguments', () => {
    expect(buildEslintArgs('/tmp/a.ts', baseOptions.eslint, true)).toEqual(['--fix', '/tmp/a.ts'])
    expect(buildEslintArgs('/tmp/a.ts', baseOptions.eslint, false)).toEqual(['/tmp/a.ts'])
  })

  it('adds the config flag when a config path is set', () => {
    const es = { bin: 'eslint', configPath: './eslint.config.js' }

    expect(buildEslintArgs('/tmp/a.ts', es, true)).toEqual([
      '-c',
      './eslint.config.js',
      '--fix',
      '/tmp/a.ts',
    ])
  })

  it('returns no diagnostics when fix is clean (exit 0)', async () => {
    const result = await runEslintForFile('/tmp/a.ts', baseOptions, {
      runner: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    })

    expect(result.message).toBeUndefined()
  })

  it('returns final check diagnostics after fix output', async () => {
    const calls: string[][] = []
    const result = await runEslintForFile('/tmp/a.ts', baseOptions, {
      runner: async (_bin, args) => {
        calls.push(args)
        if (args.includes('--fix')) {
          return { exitCode: 1, stdout: 'before fix', stderr: '' }
        }
        return { exitCode: 1, stdout: 'final diagnostics', stderr: '' }
      },
    })

    expect(calls).toHaveLength(2)
    expect(result.message).toBe('final diagnostics')
  })

  it('injects NLAB_AI_HOOK=true into every eslint invocation', async () => {
    const seenEnv: (Record<string, string> | undefined)[] = []
    await runEslintForFile('/tmp/a.ts', baseOptions, {
      runner: async (_bin, _args, env) => {
        seenEnv.push(env)
        return { exitCode: 1, stdout: 'diag', stderr: '' }
      },
    })

    // fix exits 1 ⇒ a check pass also runs; both must carry the env.
    expect(seenEnv.length).toBeGreaterThanOrEqual(1)
    expect(seenEnv.every(env => env?.NLAB_AI_HOOK === 'true')).toBe(true)
  })

  it('has no bound formatter (formatter tied to linter)', async () => {
    const { eslintAdapter } = await import('../../src/adapters/eslint')
    expect(eslintAdapter.format).toBeUndefined()
    expect(eslintAdapter.name).toBe('eslint')
  })
})
