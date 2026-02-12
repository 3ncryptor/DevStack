import path from 'node:path'

import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'formatter-prettier',
  description: 'Prettier formatting defaults',
  devDependencies: {
    prettier: '^3.4.2'
  },
  filesPath: path.join(__dirname, 'files'),
  packageJson: {
    scripts: {
      format: 'prettier . --check',
      'format:write': 'prettier . --write'
    }
  }
}

export default moduleDefinition
