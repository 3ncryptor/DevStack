import { databaseModule } from '../factory'

export default databaseModule({
  id: 'database-postgres',
  title: 'PostgreSQL',
  description: 'PostgreSQL 18, with a compose service when Docker is selected',
  provides: ['db:postgres', 'db:sql'],
  hasComposeService: true,
  url: {
    description: 'PostgreSQL connection string',
    example: '"postgresql://postgres:postgres@localhost:5432/devstack"',
    secret: true,
    schema: 'z.url()'
  }
})
