import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'quality-prettier',
  title: 'Prettier',
  category: 'quality',
  language: 'node',
  vscodeExtensions: ['esbenp.prettier-vscode'],
  depth: 'bare',
  // repo-wide tooling: at the root of a monorepo
  target: 'root',
  provides: ['formatter'],
  // .prettierrc follows the code style settings (task 5.1); every planned file is formatted with it
  description: 'Prettier formatting defaults',
  devDependencies: ['prettier'],
  filesPath: moduleFilesPath('node/quality/prettier'),
  packageJson: {
    scripts: {
      format: 'prettier . --check',
      'format:write': 'prettier . --write'
    }
  }
}

export default moduleDefinition
