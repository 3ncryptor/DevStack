import type { PackageManagerId } from '@repo/src/browser'
import {
  siBetterauth,
  siBun,
  siCssmodules,
  siDocker,
  siDrizzle,
  siEslint,
  siExpress,
  siFastify,
  siGithubactions,
  siJest,
  siJsonwebtokens,
  siMongodb,
  siMongoose,
  siMysql,
  siNestjs,
  siNextdotjs,
  siNodedotjs,
  siNpm,
  siPnpm,
  siPostgresql,
  siPrettier,
  siPrisma,
  siRedis,
  siSqlite,
  siTailwindcss,
  siTurborepo,
  siVite,
  siVitest,
  siYarn,
  type SimpleIcon
} from 'simple-icons'

/** Brand logos (Simple Icons, CC0) for the modules that have one; the rest show by name. */
export const MODULE_LOGOS: Readonly<Record<string, SimpleIcon>> = {
  'language-node': siNodedotjs,
  'layout-monorepo': siTurborepo,
  'framework-express': siExpress,
  'framework-fastify': siFastify,
  'framework-nest': siNestjs,
  'framework-nextjs': siNextdotjs,
  'framework-react-vite': siVite,
  'ui-tailwind': siTailwindcss,
  'ui-css-modules': siCssmodules,
  'testing-vitest': siVitest,
  'testing-jest': siJest,
  'database-postgres': siPostgresql,
  'database-mysql': siMysql,
  'database-sqlite': siSqlite,
  'database-mongodb': siMongodb,
  'orm-prisma': siPrisma,
  'orm-drizzle': siDrizzle,
  'orm-mongoose': siMongoose,
  'cache-redis': siRedis,
  'auth-jwt': siJsonwebtokens,
  'auth-better-auth': siBetterauth,
  'quality-eslint': siEslint,
  'quality-prettier': siPrettier,
  'devops-docker': siDocker,
  'devops-github-actions': siGithubactions
}

export const PACKAGE_MANAGER_LOGOS: Readonly<Record<PackageManagerId, SimpleIcon>> = {
  npm: siNpm,
  pnpm: siPnpm,
  yarn: siYarn,
  bun: siBun
}

const MIN_LUMINANCE = 0.25

/** The brand colour, or white when it would vanish on a black page (Express, Next.js, …). */
export function visibleColour(icon: SimpleIcon): string {
  const [r = 0, g = 0, b = 0] = [0, 2, 4].map(
    (at) => parseInt(icon.hex.slice(at, at + 2), 16) / 255
  )
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance < MIN_LUMINANCE ? '#fafafa' : `#${icon.hex}`
}
