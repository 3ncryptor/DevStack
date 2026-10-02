import { moduleFilesPath } from '../../paths'
import type { Condition, DevstackModule } from '../../types/module'
import { TODO_OPENAPI_SLOTS } from './openapi'

const AUTH: Condition = { has: 'auth' }

const todoModel = (owned: boolean): string => `model Todo {
  id        String    @id @default(uuid())
  title     String
  completed Boolean   @default(false)
  dueAt     DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
${
  owned
    ? `  ownerId   String
  owner     User      @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@index([ownerId, createdAt])`
    : '  @@index([createdAt])'
}
}`

/**
 * The Todo app template (B17.8, D-39, D-70): one complete domain from schema to pages, per user
 * when auth is selected. Everything lives in src/<domains>/todos, one repository adapter, one
 * seed script and the web app's /todos page, so it can be deleted in one step.
 */
const moduleDefinition: DevstackModule = {
  id: 'template-todo',
  title: 'Todo app',
  category: 'template',
  language: 'node',
  description:
    'Todos end to end: CRUD with filters and cursor pagination, per user with auth, seed data, tests and a page',
  // written and tested on Postgres; other databases are a later port (D-77)
  requires: ['framework-express', 'orm-prisma', 'database-postgres', 'core-backend'],
  scripts: [{ name: 'db:seed', run: 'tsx src/scripts/seed.ts' }],
  env: [
    {
      name: 'SEED_DEMO_PASSWORD',
      description:
        'Password of the demo user db:seed creates (demo@example.com). Generated for local use',
      required: false,
      secret: true,
      generate: 'secret',
      when: AUTH
    }
  ],
  slots: [
    { slot: 'prisma.models', code: todoModel(true), when: AUTH },
    { slot: 'prisma.models', code: todoModel(false), when: { not: AUTH } },
    {
      slot: 'app.imports',
      code: [
        "import { createTodosRouter } from './__domains__/todos/todos.routes.js'",
        "import type { TodosService } from './__domains__/todos/todos.service.js'"
      ].join('\n')
    },
    { slot: 'app.deps', code: 'todos: TodosService' },
    {
      slot: 'app.routes',
      code: "api.use('/todos', createTodosRouter(deps.todos, deps.auth))",
      when: AUTH
    },
    {
      slot: 'app.routes',
      code: "api.use('/todos', createTodosRouter(deps.todos))",
      when: { not: AUTH }
    },
    {
      slot: 'index.imports',
      code: [
        "import { createTodosService } from './__domains__/todos/todos.service.js'",
        "import { prismaTodoRepository } from './db/repositories/todo.repository.prisma.js'"
      ].join('\n')
    },
    { slot: 'index.deps', code: 'todos: createTodosService(prismaTodoRepository),' },
    { slot: 'test.imports', code: "import { testTodosService } from './todos.js'" },
    { slot: 'test.deps', code: 'todos: testTodosService(),' },
    ...TODO_OPENAPI_SLOTS
  ],
  filesPath: moduleFilesPath('template-todo')
}

export default moduleDefinition
