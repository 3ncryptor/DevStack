import type { RequestHandler } from 'express'

function parseAllowedOrigins(): string[] {
  const rawOrigins = process.env.ALLOWED_ORIGINS ?? ''
  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

const allowedOrigins = parseAllowedOrigins()

if (allowedOrigins.length === 0) {
  console.warn('[origin-check] ALLOWED_ORIGINS is not set: origin checks are disabled.')
}

export const originCheckMiddleware: RequestHandler = (request, response, next) => {
  if (allowedOrigins.length === 0) {
    next()
    return
  }

  const origin = request.get('origin')
  if (!origin || allowedOrigins.includes(origin)) {
    next()
    return
  }

  response.status(403).json({
    error: 'Origin not allowed'
  })
}
