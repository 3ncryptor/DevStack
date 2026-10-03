import { z } from 'zod'

const MAX_TITLE_LENGTH = 200
const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 20

/** An ISO 8601 date-time with an offset, e.g. 2026-10-02T12:00:00Z, as a Date. */
const isoDate = z.iso.datetime({ offset: true }).transform((value) => new Date(value))

export const createTodoSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
  dueAt: isoDate.nullable().optional()
})

export const updateTodoSchema = z
  .object({
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
    completed: z.boolean().optional(),
    dueAt: isoDate.nullable().optional()
  })
  .refine((changes) => Object.keys(changes).length > 0, { message: 'Nothing to update' })

export const listTodosSchema = z.object({
  completed: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  dueBefore: isoDate.optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE)
})

export const todoParamsSchema = z.object({ id: z.uuid() })

export type CreateTodoInput = z.infer<typeof createTodoSchema>
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>
export type ListTodosInput = z.infer<typeof listTodosSchema>
