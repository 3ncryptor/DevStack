import cors from 'cors'
import type { CorsOptions } from 'cors'

function parseAllowedOrigins(): string[] {
  const rawOrigins = process.env.ALLOWED_ORIGINS ?? ''
  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

const allowedOrigins = parseAllowedOrigins()

if (allowedOrigins.length === 0) {
  console.warn(
    '[cors] ALLOWED_ORIGINS is not set: requests from any origin are allowed. Set it before deploying.'
  )
}

const corsOptions: CorsOptions =
  allowedOrigins.length === 0
    ? {}
    : {
        // Another origin gets no CORS headers, so the browser blocks the cross-origin read. This
        // is not a server error; refusing the request itself is the job of origin checks.
        origin(origin, callback) {
          callback(null, !origin || allowedOrigins.includes(origin))
        },
        credentials: true
      }

export const corsMiddleware = cors(corsOptions)
