import { z } from 'zod'

import type { DevstackModule } from './types/module'

/**
 * A module as the website loads it (D-99): plain JSON. `filesPath` is left out (templates are
 * not rendered in the browser) and the options schema is JSON Schema, for the builder's fields.
 */
export type SiteModule = Omit<DevstackModule, 'filesPath' | 'options'> & {
  optionsSchema?: Record<string, unknown>
}

export function siteModules(modules: readonly DevstackModule[]): SiteModule[] {
  return modules.map((moduleDefinition) => {
    const site: SiteModule & Partial<Pick<DevstackModule, 'filesPath' | 'options'>> = {
      ...moduleDefinition
    }
    delete site.filesPath
    delete site.options
    return moduleDefinition.options === undefined
      ? site
      : { ...site, optionsSchema: z.toJSONSchema(moduleDefinition.options, { io: 'input' }) }
  })
}
