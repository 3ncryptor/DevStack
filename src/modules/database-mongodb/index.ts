import { databaseModule } from '../databases'

export default databaseModule({
  id: 'database-mongodb',
  title: 'MongoDB',
  description: 'MongoDB 8, with a compose service when Docker is selected',
  provides: ['db:mongodb'],
  hasComposeService: true,
  url: {
    description: 'MongoDB connection string',
    example: '"mongodb://localhost:27017/devstack"',
    secret: true,
    schema: 'z.url()'
  }
})
