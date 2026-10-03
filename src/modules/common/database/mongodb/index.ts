import { databaseModule } from '../factory'

export default databaseModule({
  id: 'database-mongodb',
  title: 'MongoDB',
  wizard: { question: 'database', order: 4 },
  description: 'MongoDB 8, with a compose service when Docker is selected',
  provides: ['db:mongodb'],
  traits: {
    compose: {
      kind: 'service',
      url: 'mongodb://db:27017/devstack',
      volume: 'mongo_data',
      definition: [
        'image: mongo:8',
        'ports:',
        "  - '${MONGO_PORT:-27017}:27017'",
        'healthcheck:',
        "  test: ['CMD', 'mongosh', '--quiet', '--eval', \"db.adminCommand('ping').ok\"]",
        '  interval: 5s',
        '  start_period: 60s',
        '  # mongosh is a Node program and starts slowly on a busy machine',
        '  timeout: 15s',
        '  retries: 10',
        'volumes:',
        '  - mongo_data:/data/db'
      ]
    }
  },
  url: {
    description: 'MongoDB connection string',
    example: '"mongodb://localhost:27017/devstack"',
    secret: true,
    schema: 'z.url()'
  }
})
