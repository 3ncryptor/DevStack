import { describe, expect, it } from 'vitest'

import { renderSlots } from '../src/core/planner/slots'
import { renderTemplate, type TemplateContext } from '../src/core/planner/templates'
import { ResolutionError } from '../src/errors'
import { testModule } from './helpers/modules'
import { NODE_LANGUAGE } from '../src/adapters/language/node'
import { packageManagerAdapter } from '../src/adapters/package-manager/index'
import { DEFAULT_SETTINGS } from '../src/core/settings'

const context: TemplateContext = {
  projectName: 'demo-app',
  packageManager: 'pnpm',
  pm: packageManagerAdapter('pnpm').docker('10.18.0'),
  language: NODE_LANGUAGE,
  modules: [],
  target: 'root',
  port: 3000,
  scripts: [],
  packageManagerVersion: '10.0.0',
  versions: {},
  packageNames: {},
  domainsDir: 'modules',
  moduleOptions: {},
  env: [],
  options: {},
  slots: { 'app.imports': "import cors from 'cors'", 'app.middleware': '' },
  settings: DEFAULT_SETTINGS,
  apps: {
    backend: { dir: '', name: 'api', port: 3000 },
    frontend: { dir: '', name: 'web', port: 3000 },
    admin: { dir: '', name: 'admin', port: 3002 }
  },
  database: undefined
}

describe('renderTemplate', () => {
  it('renders context values and raw slot output', () => {
    const output = renderTemplate(
      "// <%= it.projectName %>\n<%~ it.slots['app.imports'] %>\n",
      context,
      'src/app.ts.eta'
    )

    expect(output).toBe("// demo-app\nimport cors from 'cors'\n")
  })

  it('fails on an unknown variable instead of rendering a blank', () => {
    expect(() => renderTemplate('<%= it.projectNmae %>', context, 'src/app.ts.eta')).toThrow(
      /src\/app\.ts\.eta.*projectNmae/
    )
  })

  it('fails on an unknown slot name', () => {
    expect(() => renderTemplate("<%~ it.slots['app.nope'] %>", context, 'src/app.ts.eta')).toThrow(
      /app\.nope/
    )
  })
})

describe('renderSlots', () => {
  const framework = testModule({
    id: 'framework-demo',
    exposesSlots: ['app.imports', 'app.middleware']
  })

  it('orders fragments by `order`, then module order, and removes duplicates', () => {
    const slots = renderSlots([
      framework,
      testModule({
        id: 'b',
        slots: [
          { slot: 'app.imports', code: "import { b } from './b'" },
          { slot: 'app.middleware', code: 'app.use(b)', order: 20 }
        ]
      }),
      testModule({
        id: 'a',
        slots: [
          { slot: 'app.imports', code: "import { b } from './b'" },
          { slot: 'app.middleware', code: 'app.use(a)', order: 10 }
        ]
      })
    ])

    expect(slots['app.middleware']).toBe('app.use(a)\napp.use(b)')
    expect(slots['app.imports']).toBe("import { b } from './b'")
  })

  it('skips fragments meant for a framework that is not selected', () => {
    const slots = renderSlots([
      framework,
      testModule({
        id: 'x',
        slots: [{ slot: 'app.middleware', code: 'nestOnly()', for: 'framework-nest' }]
      })
    ])

    expect(slots['app.middleware']).toBe('')
  })

  it('rejects a fragment for a slot no selected module exposes', () => {
    expect(() =>
      renderSlots([
        framework,
        testModule({ id: 'x', slots: [{ slot: 'app.routes', code: 'routes()' }] })
      ])
    ).toThrow(ResolutionError)
  })
})
