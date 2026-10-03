import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

import { PACKAGE_MANAGERS } from '../adapters/package-manager/index'
import { CLI_PACKAGE } from '../core/manifest'
import { settingsSchema } from '../core/settings'
import { DevstackError, ResolutionError } from '../errors'
import {
  addModulesTool,
  initTool,
  listModulesTool,
  listPresetsTool,
  planTool,
  removeModulesTool,
  validateTool
} from './tools'

/**
 * `mcp` (task 5.7, D-84): DevStack as a local stdio MCP server, started by the AI client. The
 * same engine as the CLI; nothing is ever overwritten, and every path that is written must be
 * absolute so the assistant states exactly where.
 */

const moduleEntry = z.union([
  z.string(),
  z.object({ id: z.string(), options: z.record(z.string(), z.unknown()) })
])

const stackShape = {
  name: z.string().describe('Project name, e.g. acme-api'),
  modules: z
    .array(moduleEntry)
    .optional()
    .describe('Module ids (see list_modules); give these or a preset'),
  preset: z.string().optional().describe('A preset name (see list_presets)'),
  packageManager: z.enum(PACKAGE_MANAGERS).optional(),
  depth: z
    .enum(['bare', 'wired'])
    .optional()
    .describe('bare: config and tooling only; wired (default): everything connected'),
  settings: settingsSchema.optional().describe('Code style, TS strictness, app names, license')
}

const evolveShape = {
  directory: z.string().describe('Absolute path of the DevStack project (its root folder)'),
  modules: z.array(z.string()).min(1),
  dryRun: z.boolean().optional().describe('List the changes without writing'),
  force: z
    .boolean()
    .optional()
    .describe(
      'Overwrite files the user edited (backed up); default: write .devstack-new beside them'
    )
}

function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error)
  if (!(error instanceof DevstackError)) process.stderr.write(`${String(error)}\n`)
  const text =
    error instanceof ResolutionError
      ? JSON.stringify(
          {
            message,
            diagnostics: error.diagnostics.map((diagnostic) => ({
              message: diagnostic.message,
              ...(diagnostic.fix === undefined ? {} : { fix: diagnostic.fix })
            }))
          },
          null,
          2
        )
      : message
  return { isError: true, content: [{ type: 'text', text }] }
}

/** Runs a tool and answers with its result as JSON text and structured content. */
async function respond(run: () => unknown): Promise<CallToolResult> {
  try {
    const result = (await run()) as Record<string, unknown>
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result
    }
  } catch (error: unknown) {
    return errorResult(error)
  }
}

const READ_ONLY = { readOnlyHint: true, openWorldHint: false }
const WRITES = { readOnlyHint: false, destructiveHint: false, openWorldHint: true }

function registerReadTools(server: McpServer): void {
  server.registerTool(
    'list_modules',
    {
      title: 'List modules',
      description:
        'Every stack choice DevStack offers (frameworks, databases, ORMs, auth, tooling) with what each requires and conflicts with.',
      inputSchema: {
        category: z.string().optional().describe('e.g. framework, database, orm, auth')
      },
      annotations: READ_ONLY
    },
    (input) => respond(() => listModulesTool(input))
  )
  server.registerTool(
    'list_presets',
    {
      title: 'List presets',
      description: "Built-in presets and the user's own, with their modules.",
      annotations: READ_ONLY
    },
    () => respond(() => listPresetsTool())
  )
  server.registerTool(
    'validate',
    {
      title: 'Validate a stack',
      description:
        'Whether a list of module ids forms a valid stack; every problem comes with fixes (modules to add or remove).',
      inputSchema: { modules: z.array(z.string()).min(1) },
      annotations: READ_ONLY
    },
    (input) => respond(() => validateTool(input))
  )
  server.registerTool(
    'plan',
    {
      title: 'Plan a project',
      description:
        'What init would generate for a stack: files, environment variables, commands. Writes nothing.',
      inputSchema: stackShape,
      annotations: READ_ONLY
    },
    (input) => respond(() => planTool(input))
  )
}

function registerWriteTools(server: McpServer): void {
  server.registerTool(
    'init',
    {
      title: 'Generate a project',
      description:
        'Generates a new project into an empty or new absolute directory, then installs dependencies (install: false skips that). Never overwrites anything.',
      inputSchema: {
        ...stackShape,
        directory: z
          .string()
          .describe('Absolute path of the new project folder (empty or missing)'),
        install: z.boolean().optional()
      },
      annotations: WRITES
    },
    (input) => respond(() => initTool(input))
  )
  server.registerTool(
    'add_modules',
    {
      title: 'Add modules to a project',
      description:
        'Adds modules to a DevStack project and installs them. Files the user edited are not overwritten unless force is set.',
      inputSchema: evolveShape,
      annotations: WRITES
    },
    (input) => respond(() => addModulesTool(input))
  )
  server.registerTool(
    'remove_modules',
    {
      title: 'Remove modules from a project',
      description:
        'Removes modules: deletes only generated files the user did not change (backed up), refuses a module others still need.',
      inputSchema: evolveShape,
      annotations: { ...WRITES, destructiveHint: true }
    },
    (input) => respond(() => removeModulesTool(input))
  )
}

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'devstack', version: CLI_PACKAGE.version })
  registerReadTools(server)
  registerWriteTools(server)
  return server
}

/** Serves on stdin/stdout until the client disconnects. */
export async function runMcpServer(): Promise<void> {
  await createMcpServer().connect(new StdioServerTransport())
}
