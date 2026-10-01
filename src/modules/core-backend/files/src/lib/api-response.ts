/** Pagination input for `ApiSuccess.paginated`. */
export interface PageMeta {
  total: number
  page: number
  limit: number
}

/**
 * Every success response body: `{ success: true, data, meta? }` (D-61), the counterpart of the
 * error envelope `{ success: false, error }`.
 *
 *   response.status(201).json(new ApiSuccess(user))
 *   response.json(ApiSuccess.paginated(items, { total, page, limit }))
 *
 * Health probes (`/health`, `/ready`) stay plain: orchestrators expect their own shape.
 */
export class ApiSuccess<T> {
  readonly success = true

  constructor(
    readonly data: T,
    readonly meta?: Readonly<Record<string, unknown>>
  ) {}

  static paginated<T>(items: readonly T[], page: PageMeta): ApiSuccess<readonly T[]> {
    const pages = page.limit > 0 ? Math.ceil(page.total / page.limit) : 0
    return new ApiSuccess(items, { ...page, pages })
  }
}
