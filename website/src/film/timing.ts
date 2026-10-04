/** The film's clock and storyboard (plan: the 40s film): 1080p, 30fps, one row per scene. */
export const FPS = 30
export const WIDTH = 1920
export const HEIGHT = 1080

/** The film's Remotion composition id, shared by the root and the render script. */
export const FILM_COMPOSITION = 'DevStackFilm'

export type SceneId =
  'grind' | 'command' | 'pick' | 'generate' | 'verify' | 'run' | 'evolve' | 'end'

interface SceneRow {
  readonly id: SceneId
  readonly seconds: number
  /** The bottom-third line; `*word*` is highlighted. Built from the film's data where it counts. */
  readonly caption: (facts: { readonly files: number }) => string
}

const STORYBOARD: readonly SceneRow[] = [
  { id: 'grind', seconds: 5, caption: () => 'Every new project starts with *hours* of wiring.' },
  { id: 'command', seconds: 3, caption: () => 'Or *one command.*' },
  { id: 'pick', seconds: 6, caption: () => 'Pick your *stack.*' },
  {
    id: 'generate',
    seconds: 5,
    caption: ({ files }) => `${files} files, *wired* to each other.`
  },
  { id: 'verify', seconds: 5, caption: () => 'Checked *before* you see it.' },
  { id: 'run', seconds: 5, caption: () => 'Running. *Not* a hello world.' },
  { id: 'evolve', seconds: 5, caption: () => 'Grows *with you.*' },
  { id: 'end', seconds: 6, caption: () => 'Production-ready stacks, *wired and verified.*' }
]

const frames = (seconds: number): number => Math.round(seconds * FPS)

/** Each scene with its first frame and length, laid end to end. */
export const SCENES = STORYBOARD.map((row, index) => ({
  ...row,
  from: frames(STORYBOARD.slice(0, index).reduce((total, previous) => total + previous.seconds, 0)),
  duration: frames(row.seconds)
}))

export const DURATION_IN_FRAMES = frames(STORYBOARD.reduce((total, row) => total + row.seconds, 0))
