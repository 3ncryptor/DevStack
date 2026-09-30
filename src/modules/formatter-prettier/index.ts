import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'formatter-prettier',
  description: 'Prettier formatting defaults',
  devDependencies: ['prettier'],
  filesPath: moduleFilesPath('formatter-prettier'),
  packageJson: {
    scripts: {
      format: 'prettier . --check',
      'format:write': 'prettier . --write'
    }
  }
}

export default moduleDefinition
