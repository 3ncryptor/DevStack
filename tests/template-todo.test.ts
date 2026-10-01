import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import { getPreset } from '../src/core/presets'
import type { GenerationPlan } from '../src/types/plan'

const FULLSTACK = [...(getPreset('fullstack-next-express')?.modules ?? [])]
const BACKEND = [...(getPreset('backend')?.modules ?? [])]

function plan(modules: readonly string[]): Promise<GenerationPlan> {
  return buildGenerationPlan({
    projectName: 'todo-app',
    projectDir: '/virtual/todo-app',
    selectedModuleNames: [...modules, 'template-todo'],
    registry: loadModules(),
    packageManager: 'pnpm',
    options: { skipInstall: false, skipGit: false },
    secret: () => 'fixed-test-secret-0123456789abcdefghijklmnop'
  })
}

const contentOf = (generated: GenerationPlan, filePath: string): string =>
  generated.files.find((file) => file.path === filePath)?.content ?? ''

describe('template-todo (B17.8, D-70)', () => {
  it('owns each todo by its user when auth is selected', async () => {
    const generated = await plan([...FULLSTACK, 'auth-jwt'])
    const schema = contentOf(generated, 'apps/api/prisma/schema.prisma')

    expect(schema).toContain('owner     User      @relation(fields: [ownerId]')
    expect(schema).toContain('todos         Todo[]')
    expect(contentOf(generated, 'apps/api/src/features/todos/todos.routes.ts')).toContain(
      'router.use(requireAuth(auth))'
    )
    expect(contentOf(generated, 'apps/api/src/app.ts')).toContain(
      "api.use('/todos', createTodosRouter(deps.todos, deps.auth))"
    )
    expect(contentOf(generated, 'apps/api/.env')).toMatch(/^SEED_DEMO_PASSWORD=.+$/m)
  })

  it('shares todos without auth: no owner, no session, no demo user', async () => {
    const generated = await plan(BACKEND)
    const schema = contentOf(generated, 'prisma/schema.prisma')

    expect(schema).toContain('model Todo {')
    expect(schema).not.toContain('ownerId')
    expect(contentOf(generated, 'src/modules/todos/todos.routes.ts')).not.toContain('requireAuth')
    expect(contentOf(generated, '.env.example')).not.toContain('SEED_DEMO_PASSWORD')
  })

  it('works with Better Auth too', async () => {
    const generated = await plan([...FULLSTACK, 'auth-better-auth'])

    expect(contentOf(generated, 'apps/api/src/features/todos/todos.routes.ts')).toContain(
      "import type { Auth as AuthService } from '../auth/auth.js'"
    )
    expect(contentOf(generated, 'apps/api/src/scripts/seed.ts')).toContain('signUpEmail')
  })

  it('adds the /todos page to the web app only, behind a login with auth', async () => {
    const generated = await plan([...FULLSTACK, 'app-admin', 'auth-jwt'])

    expect(contentOf(generated, 'apps/web/app/todos/page.tsx')).toContain('<RequireAuth>')
    expect(contentOf(generated, 'apps/web/app/page.tsx')).toContain('href="/todos"')
    expect(contentOf(generated, 'apps/admin/app/todos/page.tsx')).toBe('')
  })

  it('documents the todo routes when API docs are selected, and adds db:seed', async () => {
    const generated = await plan(FULLSTACK)

    expect(contentOf(generated, 'apps/api/src/docs/openapi.ts')).toContain(
      "'/v1/todos/{id}/toggle'"
    )
    expect(contentOf(generated, 'apps/api/package.json')).toContain('"db:seed"')
  })
})
