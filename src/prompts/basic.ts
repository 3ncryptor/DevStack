import inquirer from 'inquirer'

import type { DevstackModule } from '../types/module'

function deduplicate(modules: string[]): string[] {
  return Array.from(new Set(modules))
}

function filterExistingModules(modules: string[], registry: Map<string, DevstackModule>): string[] {
  return deduplicate(modules).filter((moduleName) => registry.has(moduleName))
}

export async function runBasicPrompt(
  registry: Map<string, DevstackModule>
): Promise<{ selectedModules: string[] }> {
  const selectedModules: string[] = []

  const languageAnswer = await inquirer.prompt<{ language: string }>([
    {
      type: 'list',
      name: 'language',
      message: 'Select language/runtime',
      choices: [{ name: 'Node.js + TypeScript', value: 'language-node' }],
      default: 'language-node'
    }
  ])
  selectedModules.push(languageAnswer.language)

  const frameworkChoices: Array<{ name: string; value: string }> = []
  if (registry.has('framework-express')) {
    frameworkChoices.push({ name: 'Express', value: 'framework-express' })
  }
  if (registry.has('framework-nest')) {
    frameworkChoices.push({ name: 'NestJS', value: 'framework-nest' })
  }

  if (frameworkChoices.length === 0) {
    throw new Error('No framework modules available. Install framework modules first.')
  }

  const frameworkAnswer = await inquirer.prompt<{ framework: string }>([
    {
      type: 'list',
      name: 'framework',
      message: 'Select backend framework',
      choices: frameworkChoices,
      default: frameworkChoices[0]?.value
    }
  ])
  selectedModules.push(frameworkAnswer.framework)

  const databaseChoices: Array<{ name: string; value: string }> = [{ name: 'None', value: 'none' }]
  if (registry.has('orm-prisma')) {
    databaseChoices.unshift({ name: 'Prisma + PostgreSQL', value: 'orm-prisma' })
  }

  const databaseAnswer = await inquirer.prompt<{ database: string }>([
    {
      type: 'list',
      name: 'database',
      message: 'Select database layer',
      choices: databaseChoices,
      default: databaseChoices[0]?.value
    }
  ])

  if (databaseAnswer.database !== 'none') {
    selectedModules.push(databaseAnswer.database)
  }

  const isHttpFramework =
    frameworkAnswer.framework === 'framework-express' ||
    frameworkAnswer.framework === 'framework-nest'

  if (frameworkAnswer.framework === 'framework-express') {
    const architectureChoices: Array<{ name: string; value: string }> = []
    if (registry.has('folder-clean')) {
      architectureChoices.push({ name: 'Clean architecture', value: 'folder-clean' })
    }
    if (registry.has('folder-mvc')) {
      architectureChoices.push({ name: 'MVC', value: 'folder-mvc' })
    }

    if (architectureChoices.length > 0) {
      const architectureAnswer = await inquirer.prompt<{ architecture: string }>([
        {
          type: 'list',
          name: 'architecture',
          message: 'Select folder architecture',
          choices: architectureChoices,
          default: architectureChoices[0]?.value
        }
      ])

      selectedModules.push(architectureAnswer.architecture)
    }
  }

  const qualityChoices: Array<{ name: string; value: string; checked: boolean }> = []
  if (registry.has('linter-eslint')) {
    qualityChoices.push({ name: 'ESLint', value: 'linter-eslint', checked: true })
  }
  if (registry.has('formatter-prettier')) {
    qualityChoices.push({ name: 'Prettier', value: 'formatter-prettier', checked: true })
  }
  if (registry.has('quality-husky')) {
    qualityChoices.push({
      name: 'Husky + lint-staged + commitlint',
      value: 'quality-husky',
      checked: true
    })
  }

  if (qualityChoices.length > 0) {
    const qualityAnswer = await inquirer.prompt<{ qualityModules: string[] }>([
      {
        type: 'checkbox',
        name: 'qualityModules',
        message: 'Select quality tooling',
        choices: qualityChoices
      }
    ])

    selectedModules.push(...qualityAnswer.qualityModules)
  }

  if (isHttpFramework) {
    const securityChoices: Array<{ name: string; value: string; checked: boolean }> = []

    if (registry.has('middleware-cors')) {
      securityChoices.push({ name: 'CORS middleware', value: 'middleware-cors', checked: true })
    }
    if (registry.has('security-origin-checks')) {
      securityChoices.push({
        name: 'Origin allowlist checks (ALLOWED_ORIGINS)',
        value: 'security-origin-checks',
        checked: false
      })
    }
    if (registry.has('security-helmet')) {
      securityChoices.push({
        name: 'Helmet security headers',
        value: 'security-helmet',
        checked: true
      })
    }
    if (registry.has('rate-limit')) {
      securityChoices.push({ name: 'Rate limiting', value: 'rate-limit', checked: true })
    }
    if (registry.has('middleware-morgan')) {
      securityChoices.push({
        name: 'HTTP request logger (morgan)',
        value: 'middleware-morgan',
        checked: true
      })
    }
    if (registry.has('middleware-compression')) {
      securityChoices.push({
        name: 'Response compression',
        value: 'middleware-compression',
        checked: false
      })
    }

    if (securityChoices.length > 0) {
      const securityAnswer = await inquirer.prompt<{ securityModules: string[] }>([
        {
          type: 'checkbox',
          name: 'securityModules',
          message: 'Select API security and middleware features',
          choices: securityChoices
        }
      ])

      selectedModules.push(...securityAnswer.securityModules)
    }
  }

  const extraChoices: Array<{ name: string; value: string; checked: boolean }> = []
  if (registry.has('docker-basic')) {
    extraChoices.push({ name: 'Docker setup', value: 'docker-basic', checked: false })
  }

  if (extraChoices.length > 0) {
    const extrasAnswer = await inquirer.prompt<{ extras: string[] }>([
      {
        type: 'checkbox',
        name: 'extras',
        message: 'Select optional platform extras',
        choices: extraChoices
      }
    ])

    selectedModules.push(...extrasAnswer.extras)
  }

  return {
    selectedModules: filterExistingModules(selectedModules, registry)
  }
}
