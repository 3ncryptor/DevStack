import inquirer from 'inquirer'

import type { DevstackModule } from '../types/module'

export async function runAdvancedPrompt(
  registry: Map<string, DevstackModule>,
  defaultModules: string[] = []
): Promise<string[]> {
  const modules = Array.from(registry.values()).sort((a, b) => a.name.localeCompare(b.name))

  const answer = await inquirer.prompt<{ modules: string[] }>([
    {
      type: 'checkbox',
      name: 'modules',
      message: 'Select modules to include',
      choices: modules.map((moduleDefinition) => ({
        name: `${moduleDefinition.name} - ${moduleDefinition.description}`,
        value: moduleDefinition.name
      })),
      default: defaultModules,
      validate: (input: unknown) =>
        Array.isArray(input) && input.length > 0 ? true : 'Select at least one module to continue'
    }
  ])

  return Array.from(new Set(answer.modules))
}
