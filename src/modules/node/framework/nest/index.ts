import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule, ModuleSystem } from '../../../../types/module'

const MODULE_SYSTEMS = ['esm', 'cjs'] as const

/**
 * SWC compiles Nest's decorators at run time: an ESM loader hook, or under CommonJS the require
 * hook plus scripts/ts-resolve.mjs, which maps the sources' `.js` specifiers to `.ts` (D-91).
 */
const SWC_REGISTER: Readonly<Record<ModuleSystem, string>> = {
  esm: '--import @swc-node/register/esm-register',
  cjs: '--import ./scripts/ts-resolve.mjs -r @swc-node/register'
}

const moduleDefinition: DevstackModule = {
  id: 'framework-nest',
  title: 'NestJS',
  category: 'framework',
  language: 'node',
  wizard: { question: 'framework', order: 3 },
  provides: ['http-framework', 'http:connect', 'http:nest'],
  description: 'NestJS application starter',
  requires: ['language-node', 'core-backend'],
  dependencies: [
    '@nestjs/common',
    '@nestjs/core',
    '@nestjs/platform-express',
    'reflect-metadata',
    'rxjs'
  ],
  // SWC keeps decorator metadata in dev, which Nest's dependency injection needs (D-51)
  // unplugin-swc: Vitest compiles Nest tests with SWC, which keeps decorator metadata
  devDependencies: ['@swc-node/register', '@swc/core', '@types/express', 'unplugin-swc'],
  files: [
    { path: 'vitest.config.ts', when: { has: 'testing-vitest' }, depth: 'wired' },
    { path: 'scripts/ts-resolve.mjs', when: { moduleSystem: 'cjs' }, depth: 'wired' }
  ],
  exposesSlots: [
    'app.imports',
    'app.middleware',
    'app.deps',
    'index.imports',
    'index.deps',
    'appModule.imports',
    'appModule.modules',
    'test.imports',
    'test.deps'
  ],
  env: [
    {
      name: 'PORT',
      description: 'Port the HTTP server listens on',
      example: '3000',
      required: false,
      schema: 'z.coerce.number().int().min(1).max(65535).default(3000)'
    }
  ],
  filesPath: moduleFilesPath('node/framework/nest'),
  // wired only: at bare there is no src/main.ts and language-node's src/index.ts scripts apply
  scripts: [
    ...MODULE_SYSTEMS.flatMap((moduleSystem) => [
      {
        name: 'dev',
        run: `node --watch ${SWC_REGISTER[moduleSystem]} src/main.ts`,
        depth: 'wired' as const,
        // with pino, core-backend's dev script pipes this through pino-pretty
        when: {
          all: [{ any: [{ has: 'obs-winston' }, { has: 'obs-json-logs' }] }, { moduleSystem }]
        }
      },
      {
        name: 'test',
        run: `node ${SWC_REGISTER[moduleSystem]} --test "tests/**/*.test.ts"`,
        depth: 'wired' as const,
        when: {
          all: [
            { not: { any: [{ has: 'testing-vitest' }, { has: 'testing-jest' }] } },
            { moduleSystem }
          ]
        }
      }
    ]),
    { name: 'start', run: 'node dist/main.js', depth: 'wired' }
  ]
}

export default moduleDefinition
