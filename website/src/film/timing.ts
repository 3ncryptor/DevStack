/** The product film's clock: 30fps, 24 seconds, five scenes (plan: hero film storyboard). */
export const FPS = 30
export const WIDTH = 960
export const HEIGHT = 600

const seconds = (value: number): number => Math.round(value * FPS)

export const SCENES = {
  wizard: { from: 0, duration: seconds(5) },
  files: { from: seconds(5), duration: seconds(4.5) },
  checks: { from: seconds(9.5), duration: seconds(4.5) },
  browser: { from: seconds(14), duration: seconds(5) },
  end: { from: seconds(19), duration: seconds(5) }
} as const

export const DURATION_IN_FRAMES = seconds(24)
