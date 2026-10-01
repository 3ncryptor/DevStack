import type { DevstackModule } from '../types/module'
import coreBackend from './core-backend/index'
import dockerBasic from './devops-docker/index'
import folderClean from './arch-clean/index'
import folderMvc from './arch-mvc/index'
import formatterPrettier from './quality-prettier/index'
import frameworkExpress from './framework-express/index'
import frameworkNest from './framework-nest/index'
import languageNode from './language-node/index'
import linterEslint from './quality-eslint/index'
import middlewareCompression from './middleware-compression/index'
import middlewareCors from './middleware-cors/index'
import middlewareMorgan from './middleware-request-logger/index'
import ormPrisma from './orm-prisma/index'
import qualityHusky from './quality-husky/index'
import rateLimit from './security-rate-limit/index'
import securityHelmet from './security-helmet/index'
import securityOriginChecks from './security-origin-checks/index'

/**
 * The built-in module registry. Explicit imports (instead of scanning the directory at
 * runtime) keep the CLI bundleable and the module set deterministic.
 */
export const BUILTIN_MODULES: readonly DevstackModule[] = [
  languageNode,
  coreBackend,
  frameworkExpress,
  frameworkNest,
  ormPrisma,
  folderClean,
  folderMvc,
  linterEslint,
  formatterPrettier,
  qualityHusky,
  middlewareCors,
  securityOriginChecks,
  securityHelmet,
  rateLimit,
  middlewareMorgan,
  middlewareCompression,
  dockerBasic
]
