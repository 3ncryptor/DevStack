import { databaseModule } from '../factory'

export default databaseModule({
  id: 'database-mysql',
  title: 'MySQL',
  description: 'MySQL 8.4, with a compose service when Docker is selected',
  provides: ['db:mysql', 'db:sql'],
  hasComposeService: true,
  url: {
    description: 'MySQL connection string',
    example: '"mysql://root:mysql@localhost:3306/devstack"',
    secret: true,
    schema: 'z.url()'
  }
})
