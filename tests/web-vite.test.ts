import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import { resolveStack } from '../src/core/resolver/index'
import type { GenerationPlan } from '../src/types/plan'

const registry = loadModules()

const VITE = [
  'language-node',
  'layout-monorepo',
  'framework-express',
  'framework-react-vite',
  'database-postgres',
  'orm-prisma'
]

function plan(modules: string[]): Promise<GenerationPlan> {
  return buildGenerationPlan({
    projectName: 'spa',
    projectDir: '/virtual/spa',
    selectedModuleNames: modules,
    registry,
    packageManager: 'pnpm',
    packageManagerVersion: '12.6.0',
    options: { skipInstall: false, skipGit: false }
  })
}

const content = (result: GenerationPlan, file: string): string =>
  result.files.find((candidate) => candidate.path === file)?.content ?? ''
const paths = (result: GenerationPlan): string[] => result.files.map((file) => file.path)

describe('React + Vite (D-79)', () => {
  it('writes a single-page app in the Next.js layout, with the /api proxy', async () => {
    const result = await plan(VITE)
    const manifest = JSON.parse(content(result, 'apps/web/package.json')) as {
      type: string
      scripts: Record<string, string>
    }

    expect(paths(result)).toEqual(
      expect.arrayContaining([
        'apps/web/index.html',
        'apps/web/main.tsx',
        'apps/web/app/page.tsx',
        'apps/web/lib/status.ts',
        'apps/web/lib/api.ts',
        'apps/web/vite.config.ts'
      ])
    )
    expect(content(result, 'apps/web/vite.config.ts')).toContain("'/api': {")
    expect(content(result, 'apps/web/lib/api.ts')).toContain('import.meta.env.VITE_API_URL')
    expect(manifest.type).toBe('module')
    expect(manifest.scripts.start).toBe('vite preview')
  })

  it('shares the auth and Todo pages, with React Router in place of next/navigation', async () => {
    const result = await plan([...VITE, 'auth-jwt', 'template-todo'])
    const login = content(result, 'apps/web/app/login/page.tsx')

    expect(login).toContain("import { useRouter } from '../../lib/navigation'")
    expect(login).not.toContain('next/navigation')
    expect(login).not.toContain("'use client'")
    expect(content(result, 'apps/web/main.tsx')).toContain(
      '<Route path="/todos" element={<TodosPage />} />'
    )
  })

  it('serves the image with nginx, proxying /api to the API', async () => {
    const result = await plan([...VITE, 'devops-docker', 'devops-docker-web'])

    expect(content(result, 'apps/web/Dockerfile')).toContain(
      'FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime'
    )
    expect(content(result, 'apps/web/nginx.conf.template')).toContain('proxy_pass ${API_URL}/;')
  })

  it('keeps the admin app on Next.js for now', () => {
    const codes = resolveStack([...VITE, 'app-admin'], registry).diagnostics.map(
      (diagnostic) => diagnostic.code
    )

    expect(codes).toContain('single-select')
  })
})

describe('CSS Modules (D-79)', () => {
  it('scopes each page root with a class from app/ui.module.css', async () => {
    const result = await plan([...VITE, 'ui-css-modules', 'auth-jwt'])

    expect(paths(result)).toContain('apps/web/app/ui.module.css')
    expect(content(result, 'apps/web/app/page.tsx')).toContain('<main className={ui.page}>')
    expect(content(result, 'apps/web/app/login/page.tsx')).toContain(
      "import ui from '../ui.module.css'"
    )
    expect(content(result, 'apps/web/app/globals.css')).not.toContain('main {')
  })

  it('works with Next.js too', async () => {
    const result = await plan([
      'language-node',
      'layout-monorepo',
      'framework-express',
      'framework-nextjs',
      'ui-css-modules'
    ])

    expect(content(result, 'apps/web/app/page.tsx')).toContain('<main className={ui.page}>')
  })
})
