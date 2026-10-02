---
'create-devstack-app': minor
---

Databases and ORMs (M4):

- The wizard asks for the **database**: PostgreSQL, MySQL, SQLite or MongoDB. The compose file gets
  a matching `db` service, and `db:up`/`db:down` start and stop it.
- **ORMs** fit the database: Prisma or Drizzle on the SQL databases, Mongoose on MongoDB. Each
  wires a readiness check and a clean shutdown.
- **Redis** is an optional extra: a reconnecting client, a `redis` readiness check, a compose
  service and `REDIS_URL`.
- Auth and the Todo template keep Prisma on PostgreSQL for now.
