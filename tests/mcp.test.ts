import { access, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createMcpServer } from '../src/mcp/server'
import { removeTempDirs, tempDir } from './helpers/temp-dirs'

afterAll(removeTempDirs)

let client: Client

beforeAll(async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await createMcpServer().connect(serverSide)
  client = new Client({ name: 'test', version: '1.0.0' })
  await client.connect(clientSide)
})

afterAll(async () => {
  await client.close()
})

interface ToolResult {
  isError?: boolean
  structuredContent?: Record<string, unknown>
  content: Array<{ type: string; text?: string }>
}

const call = async (name: string, args: Record<string, unknown> = {}): Promise<ToolResult> =>
  (await client.callTool({ name, arguments: args })) as ToolResult

const exists = (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false
  )

describe('MCP server (task 5.7, D-84)', () => {
  it('offers the tools, marking which ones only read', async () => {
    const { tools } = await client.listTools()
    const readOnly = tools.filter((tool) => tool.annotations?.readOnlyHint === true)

    expect(tools.map((tool) => tool.name)).toEqual([
      'list_modules',
      'list_presets',
      'validate',
      'plan',
      'init',
      'add_modules',
      'remove_modules'
    ])
    expect(readOnly.map((tool) => tool.name)).toEqual([
      'list_modules',
      'list_presets',
      'validate',
      'plan'
    ])
  })

  it('lists modules by category and presets', async () => {
    const modules = await call('list_modules', { category: 'orm' })
    const presets = await call('list_presets')

    expect(modules.structuredContent?.modules).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'orm-prisma', category: 'orm' })])
    )
    expect(presets.structuredContent?.presets).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'backend', source: 'built-in' })])
    )
  })

  it('validates a stack and answers with the fixes', async () => {
    const result = await call('validate', { modules: ['orm-prisma'] })

    expect(result.structuredContent).toMatchObject({ valid: false })
    expect(JSON.stringify(result.structuredContent)).toContain('database-postgres')
  })

  it('plans a project without writing anything', async () => {
    const result = await call('plan', { name: 'planned-app', preset: 'backend' })

    expect(result.structuredContent?.modules).toContain('framework-express')
    expect(result.structuredContent?.files).toContain('src/app.ts')
    expect(await exists(path.join(process.cwd(), 'planned-app'))).toBe(false)
  })

  it('generates into a new folder, and refuses one that is not empty or not absolute', async () => {
    const parent = await tempDir('mcp-')
    const directory = path.join(parent, 'agent-app')
    const occupied = await tempDir('mcp-occupied-')
    await writeFile(path.join(occupied, 'mine.txt'), 'keep me')

    const created = await call('init', {
      name: 'agent-app',
      modules: ['framework-express', 'security-helmet'],
      directory,
      install: false
    })
    const refused = await call('init', { name: 'x', preset: 'backend', directory: occupied })
    const relative = await call('init', { name: 'x', preset: 'backend', directory: 'x' })

    expect(created.isError).toBeFalsy()
    expect(await exists(path.join(directory, 'src/app.ts'))).toBe(true)
    expect(refused.isError).toBe(true)
    expect(refused.content[0]?.text).toContain('not empty')
    expect(relative.isError).toBe(true)
  })

  it('reports an invalid stack as a tool error with the diagnostics', async () => {
    const result = await call('plan', { name: 'broken', modules: ['orm-prisma'] })

    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain('diagnostics')
  })
})
