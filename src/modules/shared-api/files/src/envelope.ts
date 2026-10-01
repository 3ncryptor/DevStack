/** The API's response bodies (D-61): `{ success: true, data, meta? }` or `{ success: false, error }`. */
export interface ApiSuccessBody<T> {
  success: true
  data: T
  meta?: Record<string, unknown>
}

export interface ApiErrorBody {
  success: false
  error: { code: string; message: string; requestId: string; details?: unknown }
}

export type ApiBody<T> = ApiSuccessBody<T> | ApiErrorBody

/** Pagination meta of `ApiSuccess.paginated` on the API. */
export interface PageMeta {
  total: number
  page: number
  limit: number
  pages: number
}
