import { randomUUID } from 'node:crypto'

import type { FastifyInstance, FastifyServerOptions } from 'fastify'

const HEADER = 'x-request-id'
/** An upstream id is reused only when it looks like one, so logs cannot be spoofed with junk. */
const VALID_ID = /^[\w.:-]{1,128}$/

/** Every request gets an id (an upstream one when valid); the app logs it as `requestId`. */
export const requestIdOptions: Pick<FastifyServerOptions, 'genReqId' | 'requestIdHeader'> = {
  requestIdHeader: false,
  genReqId(request) {
    const incoming = request.headers[HEADER]
    return typeof incoming === 'string' && VALID_ID.test(incoming) ? incoming : randomUUID()
  }
}

/** Echoes the id in every response, errors included. */
export function echoRequestId(app: FastifyInstance): void {
  app.addHook('onRequest', (request, reply, done) => {
    void reply.header(HEADER, request.id)
    done()
  })
}
