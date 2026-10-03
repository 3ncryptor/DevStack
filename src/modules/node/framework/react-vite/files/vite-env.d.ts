/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the browser calls the API in production (split origin); unset uses /api. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
