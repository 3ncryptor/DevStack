import type { Prompter } from '../intake/prompter'
import type { DevstackModule } from '../types/module'

export async function runAdvancedPrompt(
  registry: Map<string, DevstackModule>,
  prompter: Prompter,
  defaultModules: string[] = []
): Promise<string[]> {
  const modules = Array.from(registry.values()).sort((a, b) => a.name.localeCompare(b.name))

  const selected = await prompter.multiselect({
    message: 'Select modules to include',
    choices: modules.map((moduleDefinition) => ({
      value: moduleDefinition.name,
      label: moduleDefinition.name,
      hint: moduleDefinition.description
    })),
    initialValues: defaultModules,
    required: true
  })

  return [...new Set(selected)]
}
