import type { SiteStats } from '@repo/src/site-data'

import stats from '@/generated/stats.json'

/** The site's numbers, counted from DevStack at build time by `npm run data` (scripts/site-data.ts). */
export const STATS: SiteStats = stats
