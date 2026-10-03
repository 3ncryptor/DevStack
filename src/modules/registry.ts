import type { DevstackModule } from '../types/module'
import cacheRedis from './common/cache/redis/index'
import databaseMongodb from './common/database/mongodb/index'
import databaseMysql from './common/database/mysql/index'
import databasePostgres from './common/database/postgres/index'
import databaseSqlite from './common/database/sqlite/index'
import layoutMonorepo from './common/layout/monorepo/index'
import repoAgentsMd from './common/repo/agents-md/index'
import repoGithubHygiene from './common/repo/github-hygiene/index'
import repoVscode from './common/repo/vscode/index'
import apiDocsScalar from './node/api/docs-scalar/index'
import apiVersioning from './node/api/versioning/index'
import folderClean from './node/architecture/api/clean/index'
import folderFeature from './node/architecture/api/feature/index'
import folderFlat from './node/architecture/api/flat/index'
import folderMvc from './node/architecture/api/mvc/index'
import archWebAtomic from './node/architecture/web/atomic/index'
import archWebFeature from './node/architecture/web/feature/index'
import archWebLayer from './node/architecture/web/layer/index'
import authBetterAuth from './node/auth/better-auth/index'
import authJwt from './node/auth/jwt/index'
import authSession from './node/auth/session/index'
import coreBackend from './node/core/backend/index'
import dockerBasic from './node/devops/docker/index'
import dockerWeb from './node/devops/docker-web/index'
import githubActions from './node/devops/github-actions/index'
import frameworkExpress from './node/framework/express/index'
import frameworkFastify from './node/framework/fastify/index'
import frameworkNest from './node/framework/nest/index'
import frameworkNextjs from './node/framework/nextjs/index'
import frameworkReactVite from './node/framework/react-vite/index'
import languageNode from './node/language/node/index'
import middlewareAsyncHandler from './node/middleware/async-handler/index'
import middlewareCompression from './node/middleware/compression/index'
import middlewareCors from './node/middleware/cors/index'
import middlewareMorgan from './node/middleware/request-logger/index'
import obsJsonLogs from './node/observability/json-logs/index'
import obsWinston from './node/observability/winston/index'
import ormDrizzle from './node/orm/drizzle/index'
import ormMongoose from './node/orm/mongoose/index'
import ormPrisma from './node/orm/prisma/index'
import linterEslint from './node/quality/eslint/index'
import qualityHusky from './node/quality/husky/index'
import formatterPrettier from './node/quality/prettier/index'
import securityHelmet from './node/security/helmet/index'
import securityOriginChecks from './node/security/origin-checks/index'
import rateLimit from './node/security/rate-limit/index'
import templateTodo from './node/template/todo/index'
import testingJest from './node/testing/jest/index'
import testingVitest from './node/testing/vitest/index'
import testingVitestWeb from './node/testing/vitest-web/index'
import uiCssModules from './node/ui/css-modules/index'
import uiTailwind from './node/ui/tailwind/index'
import appAdmin from './node/web/admin/index'
import webPages from './node/web/pages/index'
import sharedApi from './node/web/shared-api/index'

/**
 * The built-in modules, each with its folder under src/modules (language, then category). Explicit
 * imports (instead of scanning the directory at runtime) keep the CLI bundleable and the module set
 * deterministic. A module's id never changes when its folder moves (ids are stable forever).
 */
const ENTRIES: ReadonlyArray<readonly [folder: string, moduleDefinition: DevstackModule]> = [
  ['node/language/node', languageNode],
  ['common/layout/monorepo', layoutMonorepo],
  ['node/core/backend', coreBackend],
  ['node/framework/express', frameworkExpress],
  ['node/framework/fastify', frameworkFastify],
  ['node/framework/nest', frameworkNest],
  ['node/framework/nextjs', frameworkNextjs],
  ['node/framework/react-vite', frameworkReactVite],
  ['node/web/pages', webPages],
  ['node/ui/tailwind', uiTailwind],
  ['node/ui/css-modules', uiCssModules],
  ['node/architecture/web/feature', archWebFeature],
  ['node/architecture/web/layer', archWebLayer],
  ['node/architecture/web/atomic', archWebAtomic],
  ['node/web/admin', appAdmin],
  ['node/testing/vitest', testingVitest],
  ['node/testing/jest', testingJest],
  ['node/testing/vitest-web', testingVitestWeb],
  ['node/web/shared-api', sharedApi],
  ['common/database/postgres', databasePostgres],
  ['common/database/mysql', databaseMysql],
  ['common/database/sqlite', databaseSqlite],
  ['common/database/mongodb', databaseMongodb],
  ['node/orm/prisma', ormPrisma],
  ['node/orm/drizzle', ormDrizzle],
  ['node/orm/mongoose', ormMongoose],
  ['common/cache/redis', cacheRedis],
  ['node/observability/winston', obsWinston],
  ['node/observability/json-logs', obsJsonLogs],
  ['node/auth/jwt', authJwt],
  ['node/auth/better-auth', authBetterAuth],
  ['node/auth/session', authSession],
  ['node/template/todo', templateTodo],
  ['node/architecture/api/feature', folderFeature],
  ['node/architecture/api/clean', folderClean],
  ['node/architecture/api/mvc', folderMvc],
  ['node/architecture/api/flat', folderFlat],
  ['node/quality/eslint', linterEslint],
  ['node/quality/prettier', formatterPrettier],
  ['node/quality/husky', qualityHusky],
  ['node/middleware/cors', middlewareCors],
  ['node/security/origin-checks', securityOriginChecks],
  ['node/security/helmet', securityHelmet],
  ['node/security/rate-limit', rateLimit],
  ['node/middleware/request-logger', middlewareMorgan],
  ['node/middleware/compression', middlewareCompression],
  ['node/middleware/async-handler', middlewareAsyncHandler],
  ['node/api/versioning', apiVersioning],
  ['node/api/docs-scalar', apiDocsScalar],
  ['node/devops/docker', dockerBasic],
  ['node/devops/docker-web', dockerWeb],
  ['node/devops/github-actions', githubActions],
  ['common/repo/agents-md', repoAgentsMd],
  ['common/repo/vscode', repoVscode],
  ['common/repo/github-hygiene', repoGithubHygiene]
]

export const BUILTIN_MODULES: readonly DevstackModule[] = ENTRIES.map(
  ([, moduleDefinition]) => moduleDefinition
)

/** Folder of each module under src/modules, by id, e.g. `orm-prisma` → `node/orm/prisma`. */
export const MODULE_FOLDERS: Readonly<Record<string, string>> = Object.fromEntries(
  ENTRIES.map(([folder, moduleDefinition]) => [moduleDefinition.id, folder])
)
