import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'repo-github-hygiene',
  title: 'GitHub hygiene files',
  category: 'repo',
  language: 'node',
  wizard: {
    question: 'repoExtras',
    order: 3,
    hint: 'Dependabot, PR and issue templates, CODEOWNERS',
    checked: true
  },
  target: 'root',
  depth: 'bare',
  description: 'Dependabot, a pull request template, bug and feature issue templates, CODEOWNERS',
  filesPath: moduleFilesPath('common/repo/github-hygiene')
}

export default moduleDefinition
