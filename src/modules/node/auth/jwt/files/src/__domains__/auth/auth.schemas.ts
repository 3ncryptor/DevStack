import { z } from 'zod'

const MAX_EMAIL_LENGTH = 254
const MIN_PASSWORD_LENGTH = 8
// argon2 hashes whatever it is given; a cap keeps one request from costing seconds of CPU
const MAX_PASSWORD_LENGTH = 128

const email = z.string().trim().toLowerCase().pipe(z.email().max(MAX_EMAIL_LENGTH))

export const registerSchema = z.object({
  email,
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  name: z.string().trim().min(1).max(100).optional()
})

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH)
})
