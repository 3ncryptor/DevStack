import type { FilmData } from '@repo/src/site-data'

import film from '@/generated/film.json'

export type { FilmData }

/** The film's stack, answered and planned by DevStack at build time (scripts/site-data.ts). */
export const FILM_DATA: FilmData = film

/** What every film scene gets: the stack, and how many frames the scene lasts. */
export interface SceneProps {
  readonly data: FilmData
  readonly duration: number
}

/** What DevStack checks before handing a project over: its gates, then a real boot. */
export const checksOf = (data: FilmData): readonly string[] => [...data.gates, 'boot']

export const CHECKS = checksOf(FILM_DATA)
