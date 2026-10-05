/**
 * The film's clock and storyboard (plan: the film): 1080p at 30fps, cut to the music. Scene
 * lengths are in bars (4 beats), so every cut lands on a beat of the track at BPM.
 */
export const FPS = 30
export const WIDTH = 1920
export const HEIGHT = 1080

/** The music track's tempo (src/film/audio/music.mp3); set from the track's listing. */
export const BPM = 120

/** The film's Remotion composition id, shared by the root and the render script. */
export const FILM_COMPOSITION = 'DevStackFilm'

const BEATS_PER_BAR = 4

/** Frames in `beats` beats of the track. */
export const beats = (count: number): number => Math.round((count * 60 * FPS) / BPM)

export type SceneId =
  | 'hook'
  | 'pain'
  | 'turn'
  | 'command'
  | 'pick'
  | 'generate'
  | 'verify'
  | 'run'
  | 'breadth'
  | 'evolve'
  | 'end'

/** What captions may quote, all from the film's data. */
export interface CaptionFacts {
  readonly files: number
  readonly modules: number
}

interface SceneRow {
  readonly id: SceneId
  readonly bars: number
  /** The on-screen line; `*word*` is highlighted. None where the picture is the words. */
  readonly caption?: (facts: CaptionFacts) => string
}

const STORYBOARD: readonly SceneRow[] = [
  { id: 'hook', bars: 1 },
  { id: 'pain', bars: 2, caption: () => 'Every new project: *hours* of wiring.' },
  { id: 'turn', bars: 1 },
  { id: 'command', bars: 2, caption: () => 'Or *one command.*' },
  { id: 'pick', bars: 1.5, caption: () => 'Pick your *stack.*' },
  { id: 'generate', bars: 1.5, caption: ({ files }) => `${files} files. *Wired together.*` },
  { id: 'verify', bars: 2, caption: () => 'Checked *before* you see it.' },
  { id: 'run', bars: 2, caption: () => 'Running. *Not* a hello world.' },
  { id: 'breadth', bars: 3, caption: ({ modules }) => `${modules} modules. *Your choice.*` },
  { id: 'evolve', bars: 2, caption: () => 'Grows *with you.*' },
  { id: 'end', bars: 2 }
]

/** Each scene with its first frame and length, laid end to end. */
export const SCENES = STORYBOARD.map((row, index) => ({
  ...row,
  from: beats(
    STORYBOARD.slice(0, index).reduce((total, previous) => total + previous.bars, 0) * BEATS_PER_BAR
  ),
  duration: beats(row.bars * BEATS_PER_BAR)
}))

export const DURATION_IN_FRAMES = beats(
  STORYBOARD.reduce((total, row) => total + row.bars, 0) * BEATS_PER_BAR
)
