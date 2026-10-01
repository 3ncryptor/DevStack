/** Liveness of the web app (A0.3): answers without calling the API. */
export function GET(): Response {
  return Response.json({ status: 'ok' })
}
