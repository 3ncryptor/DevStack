import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Plain JavaScript so the typed ESLint config can lint it without a tsconfig entry.
// `prisma generate` needs no database, so a missing DATABASE_URL must not fail it; commands
// that connect (migrate, studio) report the missing URL themselves.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: process.env.DATABASE_URL }
})
