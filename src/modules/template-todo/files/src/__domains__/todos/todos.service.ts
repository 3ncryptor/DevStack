import { NotFoundError } from '../../lib/errors.js'
import type { Todo, TodoPage, TodoRepository } from './todo.repository.js'
import type { CreateTodoInput, ListTodosInput, UpdateTodoInput } from './todos.schemas.js'

/**
 * Todos, framework- and ORM-agnostic (B17.6). `ownerId` is the logged-in user when auth is on:
 * a todo of someone else is answered exactly like a missing one, so ids cannot be probed.
 */
export interface TodosService {
  list(ownerId: string | undefined, query: ListTodosInput): Promise<TodoPage>
  get(ownerId: string | undefined, id: string): Promise<Todo>
  create(ownerId: string | undefined, input: CreateTodoInput): Promise<Todo>
  update(ownerId: string | undefined, id: string, changes: UpdateTodoInput): Promise<Todo>
  toggle(ownerId: string | undefined, id: string): Promise<Todo>
  remove(ownerId: string | undefined, id: string): Promise<void>
}

export function createTodosService(repository: TodoRepository): TodosService {
  async function owned(ownerId: string | undefined, id: string): Promise<Todo> {
    const todo = await repository.get(id)
    if (todo === null || (ownerId !== undefined && todo.ownerId !== ownerId)) {
      throw new NotFoundError('Todo not found')
    }
    return todo
  }

  return {
    list: (ownerId, query) =>
      repository.list({ ...query, ...(ownerId === undefined ? {} : { ownerId }) }),
    get: owned,
    create: (ownerId, input) =>
      repository.create({
        title: input.title,
        dueAt: input.dueAt ?? null,
        ownerId: ownerId ?? null
      }),
    async update(ownerId, id, changes) {
      await owned(ownerId, id)
      return repository.update(id, changes)
    },
    async toggle(ownerId, id) {
      const todo = await owned(ownerId, id)
      return repository.update(id, { completed: !todo.completed })
    },
    async remove(ownerId, id) {
      await owned(ownerId, id)
      await repository.delete(id)
    }
  }
}
