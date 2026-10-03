import { databaseModule } from '../factory'

export default databaseModule({
  id: 'database-postgres',
  title: 'PostgreSQL',
  wizard: { question: 'database', order: 1 },
  description: 'PostgreSQL 18, with a compose service when Docker is selected',
  provides: ['db:postgres', 'db:sql'],
  traits: {
    dialect: 'postgresql',
    compose: {
      kind: 'service',
      url: 'postgresql://postgres:postgres@db:5432/devstack',
      volume: 'postgres_data',
      definition: [
        'image: postgres:18-alpine',
        'environment:',
        '  POSTGRES_USER: postgres',
        '  POSTGRES_PASSWORD: postgres',
        '  POSTGRES_DB: devstack',
        'ports:',
        "  - '${POSTGRES_PORT:-5432}:5432'",
        'healthcheck:',
        "  test: ['CMD-SHELL', 'pg_isready -U postgres -d devstack']",
        '  interval: 5s',
        '  # first start (initializing the data directory) may be slow; failures then do not count',
        '  start_period: 60s',
        '  timeout: 3s',
        '  retries: 10',
        'volumes:',
        '  - postgres_data:/var/lib/postgresql'
      ]
    }
  },
  url: {
    description: 'PostgreSQL connection string',
    example: '"postgresql://postgres:postgres@localhost:5432/devstack"',
    secret: true,
    schema: 'z.url()'
  }
})
