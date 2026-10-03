---
'create-devstack-app': minor
---

`mcp` (M5): DevStack as a local MCP server for AI assistants. Add it with
`claude mcp add devstack -- npx create-devstack-app mcp` (or any client's config) and the assistant
can list modules and presets, validate a stack, plan a project, generate one into a new folder, and
add or remove modules in an existing project, with the same safety rules as the CLI.
