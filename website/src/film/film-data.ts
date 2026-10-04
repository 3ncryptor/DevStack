import type { FilmData } from '@repo/src/site-data'

import film from '@/generated/film.json'

export type { FilmData }

/** The film's stack, answered and planned by DevStack at build time (scripts/site-data.ts). */
export const FILM_DATA: FilmData = film

/** What DevStack checks before handing a project over: its gates, then a real boot. */
export const CHECKS: readonly string[] = [...FILM_DATA.gates, 'boot']
