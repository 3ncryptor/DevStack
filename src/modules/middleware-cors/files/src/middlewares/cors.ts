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
        origin(origin, callback) {
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true)
            return
          }

          callback(new Error('Origin is not allowed by CORS'))
        },
        credentials: true
      }

export const corsMiddleware = cors(corsOptions)
