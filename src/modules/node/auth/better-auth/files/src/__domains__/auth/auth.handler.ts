import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { AUTH_BASE_PATH, type Auth } from './auth.js'

/** The Fastify request as a Web Request, which is what Better Auth's handler takes. */
function toWebRequest(request: FastifyRequest): Request {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.append(name, Array.isArray(value) ? value.join(', ') : value)
  }
  const hasBody =
    request.body !== undefined && request.method !== 'GET' && request.method !== 'HEAD'
  return new Request(new URL(request.url, `${request.protocol}://${request.host}`), {
    method: request.method,
    headers,
    ...(hasBody ? { body: JSON.stringify(request.body) } : {})
  })
}

async function send(reply: FastifyReply, response: Response): Promise<FastifyReply> {
  void reply.status(response.status)
  response.headers.forEach((value, name) => {
    // every Set-Cookie separately: joining them would merge cookies into one invalid header
    if (name !== 'set-cookie') void reply.header(name, value)
  })
  for (const cookie of response.headers.getSetCookie()) void reply.header('set-cookie', cookie)
  return reply.send(response.body === null ? null : await response.text())
}

/** Better Auth's routes at AUTH_BASE_PATH (sign-up, sign-in, sign-out, OAuth), on Fastify. */
export function registerBetterAuth(app: FastifyInstance, auth: Auth): void {
  app.route({
    method: ['GET', 'POST'],
    url: `${AUTH_BASE_PATH}/*`,
    handler: async (request, reply) => send(reply, await auth.handler(toWebRequest(request)))
  })
}
