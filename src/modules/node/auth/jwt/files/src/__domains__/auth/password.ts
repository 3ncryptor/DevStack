import argon2 from 'argon2'

/** argon2id with the library's defaults (64 MiB, 3 passes), above the OWASP minimum (D-06). */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id })
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}

let timingHash: Promise<string> | undefined

function timingHashOnce(): Promise<string> {
  timingHash ??= hashPassword('devstack-timing-equaliser')
  return timingHash
}

/** Computes the throwaway hash at startup, so even the first unknown-email login is not slower. */
export function prepareTimingHash(): void {
  // a failure here surfaces at the first login that needs the hash; it must not crash startup
  timingHashOnce().catch(() => {
    timingHash = undefined
  })
}

/**
 * Verifies against a throwaway hash when the email is unknown, so a failed login takes as long
 * whether or not the account exists (no user enumeration through timing).
 */
export async function verifyNothing(password: string): Promise<false> {
  await argon2.verify(await timingHashOnce(), password)
  return false
}
