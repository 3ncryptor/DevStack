/**
 * Error taxonomy (buildPlan B15). The exit code tells scripts and agents what happened:
 * 1 = generation failed after writes, 2 = invalid input or stack (nothing written), 3 = user abort.
 * Anything that is not a DevstackError is a bug in DevStack and also exits 1.
 */
import type { Diagnostic } from './types/diagnostics'

export const EXIT_CODE = { ok: 0, applyFailed: 1, invalidInput: 2, aborted: 3 } as const

export abstract class DevstackError extends Error {
  abstract readonly exitCode: number

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = new.target.name
  }
}

/** Bad user input: project name, flags, config file. */
export class InputError extends DevstackError {
  readonly exitCode = EXIT_CODE.invalidInput
}

/** The selected modules cannot form a valid stack (missing requirement, conflict, cycle). */
export class ResolutionError extends DevstackError {
  readonly exitCode = EXIT_CODE.invalidInput
  /** Every problem found, so callers (wizard, MCP) can offer fixes instead of parsing text. */
  readonly diagnostics: readonly Diagnostic[]

  constructor(message: string, options?: ErrorOptions & { diagnostics?: readonly Diagnostic[] }) {
    super(message, options)
    this.diagnostics = options?.diagnostics ?? []
  }
}

/** A step failed while writing files or running commands; the project may be partial. */
export class ApplyError extends DevstackError {
  readonly exitCode = EXIT_CODE.applyFailed
}

/** A planned command failed after the files were written (D-95). */
export class CommandFailedError extends ApplyError {
  constructor(
    message: string,
    /** Command lines still to run, the failed one first, as a user would type them. */
    readonly remaining: readonly string[],
    options?: ErrorOptions
  ) {
    super(message, options)
  }
}

/** The user cancelled a prompt or declined to continue. */
export class Aborted extends DevstackError {
  readonly exitCode = EXIT_CODE.aborted

  constructor(message = 'Aborted by user.') {
    super(message)
  }
}

export function exitCodeFor(error: unknown): number {
  return error instanceof DevstackError ? error.exitCode : EXIT_CODE.applyFailed
}
