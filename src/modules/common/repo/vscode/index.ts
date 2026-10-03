import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'repo-vscode',
  title: 'VS Code setup',
  category: 'repo',
  language: 'node',
  wizard: {
    question: 'repoExtras',
    order: 2,
    hint: 'format on save, extensions, debugging',
    checked: true
  },
  target: 'root',
  depth: 'bare',
  description: 'Format and ESLint fix on save, recommended extensions, a debug launch for the API',
  filesPath: moduleFilesPath('common/repo/vscode')
}

export default moduleDefinition
