---
'create-devstack-app': minor
---

One response envelope for generated APIs, an opt-in asyncHandler, and module tests (Phase 1,
task 1.7).

- Success responses are `{ success: true, data, meta? }` through `ApiSuccess` (with
  `ApiSuccess.paginated` for `{ total, page, limit, pages }`); errors are
  `{ success: false, error: { code, message, requestId, details? } }` through `ApiError`
  (renamed from `AppError`). NestJS wraps return values automatically; `@RawResponse()` opts a
  route out. `/health` and `/ready` stay plain.
- The wizard asks whether Express projects want an `asyncHandler()` wrapper (default No:
  Express 5 forwards async errors on its own).
- Every built-in module is now tested on its own at both depths, and module definitions may not
  import anything that touches the file system, processes or the network.
