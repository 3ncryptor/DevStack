import { createHash } from 'node:crypto'
import path from 'node:path'

import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

import { CLI_PACKAGE, MANIFEST_PATH } from '../src/core/manifest'
import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import {
  commandFor,
  parseModuleOptions,
  parseModulesFlag,
  type StackSelection
} from '../src/core/stack-command'
import { InputError } from '../src/errors'
import { PACKAGE_ROOT } from '../src/paths'

const SELECTIONS: StackSelection[] = [
  {
    projectName: 'api',
    modules: ['framework-fastify', 'database-postgres', 'orm-drizzle', 'testing-vitest'],
    packageManager: 'pnpm'
  },
  {
    projectName: 'limited',
    modules: ['framework-express', 'security-rate-limit', 'auth-better-auth', 'orm-prisma'],
    moduleOptions: {
      'security-rate-limit': { algorithm: 'token-bucket', limit: 500 },
      'auth-better-auth': { github: true }
    },
    packageManager: 'npm',
    moduleSystem: 'cjs'
  },
  {
    projectName: 'tooling',
    modules: ['framework-nest'],
    packageManager: 'bun',
    depth: 'bare'
  }
]

const sha256 = (content: string): string => createHash('sha256').update(content).digest('hex')

/** The manifest the CLI plans when the command is run through a real shell (as `plan`). */
async function manifestFromCommand(command: string): Promise<string | undefined> {
  const asPlan = command
    .replace(`npx ${CLI_PACKAGE.name} `, `npx tsx ${path.join(PACKAGE_ROOT, 'bin/cli.ts')} plan `)
    .replace(/ --yes$/, ' --json')
  const { stdout } = await execa('sh', ['-c', asPlan], { cwd: PACKAGE_ROOT })
  const plan = JSON.parse(stdout) as { files: Array<{ path: string; sha256: string }> }
  return plan.files.find((file) => file.path === MANIFEST_PATH)?.sha256
}

async function manifestFromSelection(selection: StackSelection): Promise<string | undefined> {
  const plan = await buildGenerationPlan({
    projectName: selection.projectName,
    projectDir: path.join(PACKAGE_ROOT, selection.projectName),
    selectedModuleNames: [...selection.modules],
    moduleOptions: selection.moduleOptions ?? {},
    registry: loadModules(),
    packageManager: selection.packageManager ?? 'npm',
    ...(selection.depth === undefined ? {} : { depth: selection.depth }),
    settings: selection.moduleSystem === undefined ? {} : { moduleSystem: selection.moduleSystem },
    options: { skipInstall: false, skipGit: false }
  })
  const manifest = plan.files.find((file) => file.path === MANIFEST_PATH)?.content
  return manifest === undefined ? undefined : sha256(manifest)
}

describe('commandFor (D-99)', () => {
  it.each(SELECTIONS.map((selection) => [selection.projectName, selection]))(
    'the command for "%s" makes the CLI plan exactly that stack',
    async (_name, selection) => {
      const command = commandFor(selection, CLI_PACKAGE.name)

      expect(await manifestFromCommand(command)).toBe(await manifestFromSelection(selection))
    },
    60_000
  )

  it('reads as a command a person can type', () => {
    const command = commandFor(SELECTIONS[1], 'create-devstack-app')

    expect(command).toBe(
      'npx create-devstack-app limited --modules framework-express,security-rate-limit,auth-better-auth,orm-prisma' +
        ' --option security-rate-limit.algorithm=token-bucket --option security-rate-limit.limit=500' +
        ' --option auth-better-auth.github=true --pm npm --module-system cjs --yes'
    )
  })
})

describe('stack flags', () => {
  it('parses module ids and typed option values', () => {
    expect(parseModulesFlag(' a, b ,,c ')).toEqual(['a', 'b', 'c'])
    expect(
      parseModuleOptions(['x-y.limit=500', 'x-y.on=true', 'x-y.name=token-bucket', 'z.list=[1,2]'])
    ).toEqual({ 'x-y': { limit: 500, on: true, name: 'token-bucket' }, z: { list: [1, 2] } })
  })

  it('refuses an empty module list and a malformed option', () => {
    expect(() => parseModulesFlag(' , ')).toThrow(InputError)
    expect(() => parseModuleOptions(['rate-limit=5'])).toThrow(InputError)
  })
})
