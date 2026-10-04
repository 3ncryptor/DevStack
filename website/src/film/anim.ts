import { Easing, interpolate } from 'remotion'

/** The site's ease curve (lib/motion EASE), so the film moves like the page. */
const EASE = Easing.bezier(0.22, 1, 0.36, 1)

/** `from` → `to` between frames `start` and `end`, eased and held at both ends. */
export const ramp = (frame: number, start: number, end: number, from = 0, to = 1): number =>
  interpolate(frame, [start, end], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE
  })

/** How many of `count` items have appeared by `frame`, one every `every` frames from `start`. */
export const revealed = (frame: number, start: number, every: number, count: number): number =>
  Math.max(0, Math.min(count, Math.floor((frame - start) / every) + 1))
