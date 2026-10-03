/** The todos domain's data access, as an interface (B17.6): Prisma in production, memory in tests. */

export interface Todo {
  id: string
  title: string
  completed: boolean
  dueAt: Date | null
  createdAt: Date
  updatedAt: Date
  /** The user it belongs to when auth is on; null when todos are shared. */
  ownerId: string | null
}

export interface NewTodo {
  title: string
  dueAt: Date | null
  ownerId: string | null
}

/** Validated input: a field left out of the request is undefined. */
export interface TodoChanges {
  title?: string | undefined
  completed?: boolean | undefined
  dueAt?: Date | null | undefined
}

export interface TodoListQuery {
  ownerId?: string | undefined
  completed?: boolean | undefined
  /** Only todos due before this moment. */
  dueBefore?: Date | undefined
  /** Id of the last todo of the previous page. */
  cursor?: string | undefined
  limit: number
}

/** Newest first; `nextCursor` is null on the last page. */
export interface TodoPage {
  items: Todo[]
  nextCursor: string | null
}

export interface TodoRepository {
  list(query: TodoListQuery): Promise<TodoPage>
  get(id: string): Promise<Todo | null>
  create(todo: NewTodo): Promise<Todo>
  update(id: string, changes: TodoChanges): Promise<Todo>
  delete(id: string): Promise<void>
}
