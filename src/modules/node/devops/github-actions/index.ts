import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'devops-github-actions',
  title: 'GitHub Actions CI',
  category: 'devops',
  language: 'node',
  vscodeExtensions: ['github.vscode-github-actions'],
  target: 'root',
  depth: 'bare',
  description: 'A CI workflow that installs with your package manager and runs every gate',
  requires: ['language-node'],
  filesPath: moduleFilesPath('node/devops/github-actions')
}

export default moduleDefinition
