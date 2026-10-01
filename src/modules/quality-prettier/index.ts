import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'quality-prettier',
  title: 'Prettier',
  category: 'quality',
  language: 'node',
  depth: 'bare',
  provides: ['formatter'],
  description: 'Prettier formatting defaults',
  devDependencies: ['prettier'],
  filesPath: moduleFilesPath('quality-prettier'),
  packageJson: {
    scripts: {
      format: 'prettier . --check',
      'format:write': 'prettier . --write'
    }
  }
}

export default moduleDefinition
