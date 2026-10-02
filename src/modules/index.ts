import type { DevstackModule } from '../types/module'
import apiDocsScalar from './api-docs-scalar/index'
import apiVersioning from './api-versioning/index'
import appAdmin from './app-admin/index'
import authBetterAuth from './auth-better-auth/index'
import authJwt from './auth-jwt/index'
import authSession from './auth-session/index'
import cacheRedis from './cache-redis/index'
import databaseMongodb from './database-mongodb/index'
import databaseMysql from './database-mysql/index'
import databasePostgres from './database-postgres/index'
import databaseSqlite from './database-sqlite/index'
import archWebAtomic from './arch-web-atomic/index'
import archWebFeature from './arch-web-feature/index'
import archWebLayer from './arch-web-layer/index'
import coreBackend from './core-backend/index'
import dockerBasic from './devops-docker/index'
import dockerWeb from './devops-docker-web/index'
import githubActions from './devops-github-actions/index'
import folderClean from './arch-clean/index'
import folderFlat from './arch-flat/index'
import folderFeature from './arch-feature/index'
import folderMvc from './arch-mvc/index'
import formatterPrettier from './quality-prettier/index'
import frameworkExpress from './framework-express/index'
import frameworkFastify from './framework-fastify/index'
import frameworkNest from './framework-nest/index'
import frameworkNextjs from './framework-nextjs/index'
import frameworkReactVite from './framework-react-vite/index'
import languageNode from './language-node/index'
import layoutMonorepo from './layout-monorepo/index'
import linterEslint from './quality-eslint/index'
import middlewareAsyncHandler from './middleware-async-handler/index'
import middlewareCompression from './middleware-compression/index'
import middlewareCors from './middleware-cors/index'
import middlewareMorgan from './middleware-request-logger/index'
import obsJsonLogs from './obs-json-logs/index'
import obsWinston from './obs-winston/index'
import ormDrizzle from './orm-drizzle/index'
import ormMongoose from './orm-mongoose/index'
import ormPrisma from './orm-prisma/index'
import qualityHusky from './quality-husky/index'
import rateLimit from './security-rate-limit/index'
import repoAgentsMd from './repo-agents-md/index'
import repoGithubHygiene from './repo-github-hygiene/index'
import repoVscode from './repo-vscode/index'
import securityHelmet from './security-helmet/index'
import securityOriginChecks from './security-origin-checks/index'
import sharedApi from './shared-api/index'
import templateTodo from './template-todo/index'
import testingJest from './testing-jest/index'
import testingVitest from './testing-vitest/index'
import testingVitestWeb from './testing-vitest-web/index'
import uiCssModules from './ui-css-modules/index'
import uiTailwind from './ui-tailwind/index'
import webPages from './web-pages/index'

/**
 * The built-in module registry. Explicit imports (instead of scanning the directory at
 * runtime) keep the CLI bundleable and the module set deterministic.
 */
export const BUILTIN_MODULES: readonly DevstackModule[] = [
  languageNode,
  layoutMonorepo,
  coreBackend,
  frameworkExpress,
  frameworkFastify,
  frameworkNest,
  frameworkNextjs,
  frameworkReactVite,
  webPages,
  uiTailwind,
  uiCssModules,
  archWebFeature,
  archWebLayer,
  archWebAtomic,
  appAdmin,
  testingVitest,
  testingJest,
  testingVitestWeb,
  sharedApi,
  databasePostgres,
  databaseMysql,
  databaseSqlite,
  databaseMongodb,
  ormPrisma,
  ormDrizzle,
  ormMongoose,
  cacheRedis,
  obsWinston,
  obsJsonLogs,
  authJwt,
  authBetterAuth,
  authSession,
  templateTodo,
  folderFeature,
  folderClean,
  folderMvc,
  folderFlat,
  linterEslint,
  formatterPrettier,
  qualityHusky,
  middlewareCors,
  securityOriginChecks,
  securityHelmet,
  rateLimit,
  middlewareMorgan,
  middlewareCompression,
  middlewareAsyncHandler,
  apiVersioning,
  apiDocsScalar,
  dockerBasic,
  dockerWeb,
  githubActions,
  repoAgentsMd,
  repoVscode,
  repoGithubHygiene
]
