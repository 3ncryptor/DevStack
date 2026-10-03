import { describe, expect, it } from 'vitest'

import { NODE_LANGUAGE } from '../src/adapters/language/node'
import {
  choosePackageManager,
  packageManagerAdapter,
  PACKAGE_MANAGERS,
  type PackageManagerId
} from '../src/adapters/package-manager/index'
import { InputError } from '../src/errors'
import { runCreateDevstack } from '../src/index'
import { ScriptedPrompter } from './helpers/scripted-prompter'

describe('package manager adapters', () => {
  it.each<[PackageManagerId, string, string[], string[], string, string]>([
    [
      'npm',
      'package-lock.json',
      ['install'],
      ['exec', '--', 'husky'],
      'npx --no -- lint-staged',
      'npm ci'
    ],
    [
      'pnpm',
      'pnpm-lock.yaml',
      ['install'],
      ['exec', 'husky'],
      'pnpm exec lint-staged',
      'pnpm install --frozen-lockfile'
    ],
    [
      'yarn',
      'yarn.lock',
      ['install'],
      ['husky'],
      'yarn lint-staged',
      'yarn install --frozen-lockfile'
    ],
    [
      'bun',
      'bun.lock',
      ['install'],
      ['x', 'husky'],
      'bunx lint-staged',
      'bun install --frozen-lockfile'
    ]
  ])(
    '%s: lockfile, install, exec, hook and Docker lines',
    (id, lockfile, install, exec, hook, frozen) => {
      const adapter = packageManagerAdapter(id)

      expect(adapter.lockfile).toBe(lockfile)
      expect(adapter.install()).toEqual(install)
      expect(adapter.exec('husky')).toEqual(exec)
      expect(adapter.hookCommand('lint-staged')).toBe(hook)
      expect(adapter.docker('1.0.0').installFrozen).toBe(frozen)
      expect(adapter.run('dev')).toEqual(['run', 'dev'])
    }
  )

  it('covers every package manager the Node adapter supports', () => {
    expect([...NODE_LANGUAGE.packageManagers].sort()).toEqual([...PACKAGE_MANAGERS].sort())
  })
})

describe('choosePackageManager', () => {
  const none = { flag: undefined, config: undefined, userAgent: '', lockfiles: [] }

  it('prefers --pm, then the config, then how the CLI was invoked, then a lockfile, then npm', () => {
    expect(
      choosePackageManager({
        ...none,
        flag: 'bun',
        config: 'yarn',
        userAgent: 'pnpm/12',
        lockfiles: ['package-lock.json']
      })
    ).toEqual({ id: 'bun', source: '--pm' })
    expect(choosePackageManager({ ...none, config: 'yarn', userAgent: 'pnpm/12' })).toEqual({
      id: 'yarn',
      source: 'config'
    })
    expect(
      choosePackageManager({
        ...none,
        userAgent: 'pnpm/12.6.0 npm/? node/v24',
        lockfiles: ['package-lock.json']
      })
    ).toEqual({ id: 'pnpm', source: 'invoked with pnpm' })
    expect(choosePackageManager({ ...none, lockfiles: ['yarn.lock'] })).toEqual({
      id: 'yarn',
      source: 'yarn.lock in this folder'
    })
    expect(choosePackageManager(none)).toEqual({ id: 'npm', source: 'default' })
  })

  it('treats a plain npm user agent as no signal, so a lockfile still counts', () => {
    expect(
      choosePackageManager({
        ...none,
        userAgent: 'npm/11.0.0 node/v24',
        lockfiles: ['pnpm-lock.yaml']
      }).id
    ).toBe('pnpm')
  })
})

describe('--pm', () => {
  it('rejects an unsupported package manager', async () => {
    await expect(
      runCreateDevstack({
        projectName: 'pm-app',
        options: { pm: 'pip' as never, yes: true, dryRun: true },
        prompter: new ScriptedPrompter([])
      })
    ).rejects.toThrow(InputError)
  })
})

describe('Docker installs the package manager that wrote the lockfile', () => {
  it('pins pnpm and bun to the probed version, so the frozen install vets it the same way', () => {
    expect(packageManagerAdapter('pnpm').docker('10.26.2').setup).toBe(
      'RUN npm install --global pnpm@10.26.2'
    )
    expect(packageManagerAdapter('bun').docker('1.3.0').setup).toBe(
      'RUN npm install --global bun@1.3.0'
    )
    expect(packageManagerAdapter('npm').docker('11.6.2').setup).toBe('')
  })
})
