import { databaseModule } from '../factory'

export default databaseModule({
  id: 'database-mysql',
  title: 'MySQL',
  description: 'MySQL 8.4, with a compose service when Docker is selected',
  provides: ['db:mysql', 'db:sql'],
  traits: {
    dialect: 'mysql',
    compose: {
      kind: 'service',
      url: 'mysql://root:mysql@db:3306/devstack',
      volume: 'mysql_data',
      definition: [
        'image: mysql:8.4',
        'environment:',
        '  MYSQL_ROOT_PASSWORD: mysql',
        '  MYSQL_DATABASE: devstack',
        'ports:',
        "  - '${MYSQL_PORT:-3306}:3306'",
        'healthcheck:',
        '  # over TCP: the server MySQL runs during first-start initialization listens on the socket only',
        "  test: ['CMD', 'mysqladmin', 'ping', '-h', '127.0.0.1', '-uroot', '-pmysql']",
        '  interval: 5s',
        '  start_period: 60s',
        '  timeout: 3s',
        '  retries: 20',
        'volumes:',
        '  - mysql_data:/var/lib/mysql'
      ]
    }
  },
  url: {
    description: 'MySQL connection string',
    example: '"mysql://root:mysql@localhost:3306/devstack"',
    secret: true,
    schema: 'z.url()'
  }
})
