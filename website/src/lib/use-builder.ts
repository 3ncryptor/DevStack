'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  commandFor,
  moduleOptionsFromAnswers,
  modulesFromAnswers,
  resolveStack,
  wizardForm,
  type Diagnostic,
  type FormQuestion,
  type Shell,
  type WizardAnswers
} from '@repo/src/browser'

import { registry } from '@/lib/registry'

import cliPackage from '@repo/package.json'

const ENVIRONMENT = { registry, defaultPackageManager: 'npm' } as const
const DEFAULT_NAME = 'my-app'
const SHARE_PARAM = 'stack'

/** What a share link carries: the project name and the answers the visitor picked. */
interface Shared {
  readonly name: string
  readonly picks: WizardAnswers
}

const encode = (shared: Shared): string =>
  btoa(JSON.stringify(shared)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

function decode(value: string | null): Shared | undefined {
  if (value === null) return undefined
  try {
    const parsed: unknown = JSON.parse(atob(value.replaceAll('-', '+').replaceAll('_', '/')))
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const { name, picks } = parsed as Partial<Shared>
    return typeof name === 'string' && typeof picks === 'object' && picks !== null
      ? { name, picks }
      : undefined
  } catch {
    return undefined
  }
}

/** npm-style: lowercase letters, digits, dots, dashes and underscores. The CLI checks the rest. */
const tidyName = (name: string): string =>
  name
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/g, '-')
    .slice(0, 214)

export interface BuiltStack {
  readonly questions: FormQuestion[]
  readonly modules: string[]
  readonly diagnostics: Diagnostic[]
  readonly command: Readonly<Record<Shell, string>>
}

/**
 * The stack builder's state: the visitor's picks and project name, and everything DevStack
 * derives from them (the questions to ask, the modules, conflicts and the final commands).
 */
export function useBuilder() {
  // a share link opens the builder on its stack (the builder renders in the browser only)
  const [shared] = useState(() =>
    decode(new URLSearchParams(window.location.search).get(SHARE_PARAM))
  )
  const [name, setName] = useState(() => tidyName(shared?.name ?? '') || DEFAULT_NAME)
  const [picks, setPicks] = useState<WizardAnswers>(shared?.picks ?? {})
  const [form, setForm] = useState<{ questions: FormQuestion[]; answers: WizardAnswers }>()

  useEffect(() => {
    let current = true
    void wizardForm(picks, ENVIRONMENT).then((next) => {
      if (current) setForm(next)
    })
    return () => {
      current = false
    }
  }, [picks])

  const stack = useMemo((): BuiltStack | undefined => {
    if (form === undefined) return undefined
    const { answers } = form
    const modules = modulesFromAnswers(answers, registry)
    const selection = {
      projectName: name || DEFAULT_NAME,
      modules,
      moduleOptions: moduleOptionsFromAnswers(answers, registry),
      ...(answers.packageManager === undefined ? {} : { packageManager: answers.packageManager }),
      ...(answers.moduleSystem === undefined ? {} : { moduleSystem: answers.moduleSystem })
    }
    return {
      questions: form.questions,
      modules,
      diagnostics: resolveStack(modules, registry).diagnostics,
      command: {
        posix: commandFor(selection, cliPackage.name),
        powershell: commandFor(selection, cliPackage.name, 'powershell')
      }
    }
  }, [form, name])

  return {
    name,
    setName: (value: string) => setName(tidyName(value)),
    stack,
    pick: (key: keyof WizardAnswers, value: unknown) => setPicks({ ...picks, [key]: value }),
    reset: () => setPicks({}),
    shareLink: () => `${window.location.origin}/?${SHARE_PARAM}=${encode({ name, picks })}#build`
  }
}
