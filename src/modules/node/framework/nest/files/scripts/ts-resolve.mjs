// Runs the TypeScript sources under CommonJS with `node -r @swc-node/register` (dev, tests):
// their imports say `./file.js` (NodeNext), so a missing .js file resolves to the .ts beside it.
// The hook is synchronous, so it applies to require() as well.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      const notFound = error?.code === 'MODULE_NOT_FOUND' || error?.code === 'ERR_MODULE_NOT_FOUND'
      if (!notFound || !specifier.startsWith('.') || !specifier.endsWith('.js')) throw error
      try {
        return nextResolve(`${specifier.slice(0, -3)}.ts`, context)
      } catch {
        // no .ts either: report the specifier as it was written
        throw error
      }
    }
  }
})
