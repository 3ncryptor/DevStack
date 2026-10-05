/**
 * What the website runs in the browser (D-99): the resolver, the wizard's questions and choice
 * rules, and the command builder, so the stack builder offers exactly what the CLI accepts. The
 * module definitions come as data (they compute template paths with node:fs); nothing reachable
 * from here may import a Node built-in, which tests/browser.test.ts checks.
 */
export { PACKAGE_MANAGERS, type PackageManagerId } from './adapters/package-manager/index'
export { applyFixAction, resolveStack } from './core/resolver/index'
export { MODULE_SYSTEMS } from './core/settings'
export {
  commandFor,
  type ModuleOptions,
  type Shell,
  type StackSelection
} from './core/stack-command'
export { fitsStack, moduleChoices, type ModuleChoice } from './prompts/wizard/choices'
export { wizardForm, type FormQuestion } from './prompts/wizard/form'
export {
  ALWAYS_INCLUDED,
  ALWAYS_INCLUDED_LABEL,
  answersFromModules,
  moduleOptionsFromAnswers,
  modulesFromAnswers,
  STEPS,
  type WizardAnswers,
  type WizardStep
} from './prompts/wizard/steps'
export type { Diagnostic, FixAction } from './types/diagnostics'
export type {
  Depth,
  DevstackModule,
  ModuleCategory,
  ModuleSystem,
  WizardQuestion
} from './types/module'
