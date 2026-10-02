---
'create-devstack-app': minor
---

Choose the logger: pino (default), Winston, or plain JSON lines with no logging library, for
Express, Fastify and NestJS. Every choice writes JSON with request ids and redacts the
`authorization` and `cookie` headers.
