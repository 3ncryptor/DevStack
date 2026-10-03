import { moduleFilesPath } from '../../../../paths'
import { databaseModule } from '../factory'

export default databaseModule({
  id: 'database-sqlite',
  title: 'SQLite',
  description: 'SQLite in a local file: no server to run',
  provides: ['db:sqlite', 'db:sql'],
  traits: {
    dialect: 'sqlite',
    // the file outlives the container on a volume the app mounts
    compose: {
      kind: 'file',
      url: 'file:/app/data/dev.db',
      volume: 'sqlite_data',
      dataDir: '/app/data'
    }
  },
  filesPath: moduleFilesPath('common/database/sqlite'),
  url: {
    description: 'SQLite database file, relative to the working directory',
    example: '"file:./dev.db"',
    schema: "z.string().startsWith('file:')"
  }
})
