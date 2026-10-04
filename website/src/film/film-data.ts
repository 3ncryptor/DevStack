import type { FilmData } from '@repo/src/site-data'

import film from '@/generated/film.json'

export type { FilmData }

/** The film's stack, answered and planned by DevStack at build time (scripts/site-data.ts). */
export const FILM_DATA: FilmData = film
