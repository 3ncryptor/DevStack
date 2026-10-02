import { moduleFilesPath } from '../../paths'
import { databaseModule } from '../databases'

export default databaseModule({
  id: 'database-sqlite',
  title: 'SQLite',
  description: 'SQLite in a local file: no server to run',
  provides: ['db:sqlite', 'db:sql'],
  hasComposeService: false,
  filesPath: moduleFilesPath('database-sqlite'),
  url: {
    description: 'SQLite database file, relative to the working directory',
    example: '"file:./dev.db"',
    schema: "z.string().startsWith('file:')"
  }
})
