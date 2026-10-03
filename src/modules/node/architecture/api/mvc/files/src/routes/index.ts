export type RouteDefinition = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
}

export const routes: RouteDefinition[] = []
