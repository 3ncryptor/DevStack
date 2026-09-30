import { describe, expect, it } from 'vitest'

import { pnpmWorkspaceYaml } from '../src/core/generator'

describe('pnpmWorkspaceYaml', () => {
  it('approves exactly the given packages for both pnpm 12 and pnpm 10 config keys', () => {
    expect(pnpmWorkspaceYaml(['@prisma/engines', 'esbuild'])).toBe(
      [
        '# Packages whose install scripts pnpm may run. Keep this list minimal.',
        'allowBuilds:',
        "  '@prisma/engines': true",
        "  'esbuild': true",
        'onlyBuiltDependencies:',
        "  - '@prisma/engines'",
        "  - 'esbuild'",
        ''
      ].join('\n')
    )
  })
})
