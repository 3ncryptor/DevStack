/**
 * Composes the film's music (plan: the film, sound): an upbeat electronic track at the film's
 * BPM, arranged from the storyboard in src/film/timing.ts so it follows the scenes (the drop
 * lands on Enter, the lift on the logo walls). Ours, repeatable: `npm run film:music` →
 * src/film/audio/music.wav.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { BPM, DURATION_IN_FRAMES, FPS, SCENES, type SceneId } from '../src/film/timing'
import { Bus, decay, noise, normalized, OnePole, RATE, sine, sound, wav } from './audio'

const BEAT_S = 60 / BPM
/** Mix levels: the kick sits under the music, not on top of it. */
const KICK = 0.75
const LENGTH_S = DURATION_IN_FRAMES / FPS
const OUT = path.join(process.cwd(), 'src/film/audio')

/** The beat a scene starts on. */
function startOf(id: SceneId): number {
  const scene = SCENES.find((row) => row.id === id)
  if (scene === undefined) throw new Error(`no scene ${id} in the storyboard`)
  return scene.from / FPS / BEAT_S
}

/** Am – F – C – G, one chord per bar: bass root, chord tones (pads, stabs, arpeggio). */
const PROGRESSION = [
  { root: 110, tones: [220, 261.63, 329.63] },
  { root: 87.31, tones: [174.61, 220, 261.63] },
  { root: 130.81, tones: [261.63, 329.63, 392] },
  { root: 98, tones: [196, 246.94, 293.66] }
] as const
const chordAt = (beat: number) =>
  PROGRESSION[Math.floor(beat / 4) % PROGRESSION.length] ?? PROGRESSION[0]

/** The instruments: drums once, pitched sounds per note (cached, so the song renders fast). */
class Instruments {
  private readonly cache = new Map<string, Float32Array>()

  private cached(key: string, make: () => Float32Array): Float32Array {
    const hit = this.cache.get(key)
    if (hit !== undefined) return hit
    const made = make()
    this.cache.set(key, made)
    return made
  }

  kick(): Float32Array {
    return this.cached('kick', () => {
      let phase = 0
      return sound(0.45, (t) => {
        phase += (48 + 120 * decay(t, 30)) / RATE
        return Math.sin(2 * Math.PI * phase) * decay(t, 6.5) + noise() * decay(t, 400) * 0.25
      })
    })
  }

  clap(): Float32Array {
    return this.cached('clap', () => {
      const filter = new OnePole()
      const burst = (t: number): boolean =>
        [0, 0.011, 0.022].some((at) => t >= at && t < at + 0.008)
      return sound(0.3, (t) => {
        const envelope = t < 0.03 ? (burst(t) ? 1 : 0.25) : decay(t - 0.03, 14)
        return filter.highPass(noise(), 1200) * envelope * 0.7
      })
    })
  }

  hat(open: boolean): Float32Array {
    return this.cached(`hat-${open}`, () => {
      const filter = new OnePole()
      return sound(
        open ? 0.3 : 0.06,
        (t) => filter.highPass(noise(), 7000) * decay(t, open ? 12 : 70) * 0.5
      )
    })
  }

  crash(): Float32Array {
    return this.cached('crash', () => {
      const filter = new OnePole()
      return sound(2.5, (t) => filter.highPass(noise(), 3000) * decay(t, 1.8) * 0.45)
    })
  }

  /** A saw bass with a sine underneath, through a low-pass at `cutoff`. */
  bass(hz: number, seconds: number, cutoff: number): Float32Array {
    return this.cached(`bass-${hz}-${seconds}-${Math.round(cutoff)}`, () => {
      const filter = new OnePole()
      let phase = 0
      return sound(seconds, (t) => {
        phase = (phase + hz / RATE) % 1
        const envelope = Math.min(1, t / 0.005) * Math.min(1, (seconds - t) / 0.02)
        return (filter.lowPass(2 * phase - 1, cutoff) * 0.55 + sine(t, hz) * 0.45) * envelope
      })
    })
  }

  /** Detuned saws per note (a supersaw), filtered; plucked chords decay, pads swell. */
  chord(tones: readonly number[], seconds: number, plucked: boolean): Float32Array {
    return this.cached(`chord-${tones.join()}-${seconds}-${plucked}`, () => {
      const filter = new OnePole()
      const voices = tones.flatMap((hz) => [hz * 0.994, hz, hz * 1.006])
      const phases = voices.map((_, index) => (index * 0.37) % 1)
      return sound(seconds, (t) => {
        let sum = 0
        voices.forEach((hz, index) => {
          phases[index] = ((phases[index] ?? 0) + hz / RATE) % 1
          sum += 2 * (phases[index] ?? 0) - 1
        })
        const envelope = plucked
          ? decay(t, 7)
          : Math.min(1, t / 0.15) * Math.min(1, (seconds - t) / 0.4)
        return filter.lowPass(sum / voices.length, plucked ? 2600 : 1800) * envelope
      })
    })
  }

  pluck(hz: number): Float32Array {
    return this.cached(`pluck-${hz}`, () => {
      const filter = new OnePole()
      let phase = 0
      return sound(0.25, (t) => {
        phase = (phase + hz / RATE) % 1
        return filter.lowPass(2 * phase - 1, 900 + 3200 * decay(t, 20)) * decay(t, 14)
      })
    })
  }

  /** Noise and a sweeping tone that rise over `beats` into the next section. */
  riser(beats: number): Float32Array {
    return this.cached(`riser-${beats}`, () => {
      const filter = new OnePole()
      const seconds = beats * BEAT_S
      return sound(seconds, (t) => {
        const rise = (t / seconds) ** 2
        const swept = filter.lowPass(noise(), 200 + 9000 * rise) * 0.7
        return (swept + sine(t, 200 + 900 * rise) * 0.15) * rise
      })
    })
  }
}

/** The song, section by section, following the film's scenes. */
class Song {
  readonly drums = new Bus(LENGTH_S, BPM)
  readonly music = new Bus(LENGTH_S, BPM)
  readonly kicks: number[] = []
  private readonly play = new Instruments()

  private kick(beat: number, gain = KICK): void {
    this.drums.add(beat, this.play.kick(), gain)
    this.kicks.push(beat)
  }

  /** Hook: a kick and a bass stab under each slammed word. */
  hook(from: number, to: number): void {
    this.drums.add(from, this.play.crash(), 0.7)
    for (let beat = from; beat < to; beat += 1) {
      this.kick(beat)
      this.music.add(beat, this.play.bass(chordAt(0).root, 0.3, 900), 0.8)
    }
  }

  /** Pain: half-time kick, ticking hats and a pulsing bass whose filter slowly opens. */
  pain(from: number, to: number): void {
    // the pad rings on into the turn, so the breakdown is never dead air
    this.music.add(from, this.play.chord(chordAt(0).tones, (to - from + 2) * BEAT_S, false), 0.45)
    for (let step = from; step < to; step += 0.25) {
      if (step % 2 === 0) this.kick(step)
      if (step % 0.5 === 0) this.drums.add(step, this.play.hat(false), 0.3, 0.3)
      const cutoff = 300 + 1500 * ((step - from) / (to - from))
      this.music.add(step, this.play.bass(chordAt(0).root, 0.11, cutoff), 0.55)
    }
  }

  /** Turn: the floor drops out; only a riser. */
  turn(from: number, to: number): void {
    this.music.add(from, this.play.riser(to - from), 0.5)
  }

  /** Build: kicks, a snare roll speeding up and the bass filter opening, into the drop. */
  build(from: number, drop: number): void {
    this.music.add(from, this.play.riser(drop - from), 0.55)
    for (let step = from; step < drop; step += 0.25) {
      if (step % 1 === 0) this.kick(step, KICK * (0.6 + 0.4 * ((step - from) / (drop - from))))
      const roll = drop - step <= 1 ? 0.25 : drop - step <= 2 ? 0.5 : 0
      if (roll > 0 && (step - from) % roll === 0) {
        this.drums.add(step, this.play.clap(), 0.35 + 0.5 * ((step - from) / (drop - from)))
      }
      if (step % 0.5 === 0) {
        const cutoff = 400 + 2200 * ((step - from) / (drop - from))
        this.music.add(step, this.play.bass(chordAt(0).root, 0.22, cutoff), 0.6)
      }
    }
  }

  /** Groove: four on the floor, claps, pumping bass, offbeat stabs, an arpeggio when `arp`. */
  groove(from: number, to: number, arp: 0 | 2 | 4): void {
    for (let beat = from; beat < to; beat += 1) {
      const chord = chordAt(beat)
      this.kick(beat)
      if (beat % 2 === 1) this.drums.add(beat, this.play.clap(), 0.6)
      this.drums.add(beat + 0.5, this.play.hat(true), 0.35, -0.2)
      this.drums.add(beat + 0.25, this.play.hat(false), 0.18, 0.3)
      this.drums.add(beat + 0.75, this.play.hat(false), 0.18, 0.3)
      this.music.add(beat, this.play.bass(chord.root, 0.22, 900), 0.9)
      this.music.add(beat + 0.5, this.play.bass(chord.root * 2, 0.22, 1100), 0.7)
      this.music.add(beat + 0.5, this.play.chord(chord.tones, 0.35, true), 0.55)
      if (beat % 4 === 0) {
        this.music.add(beat, this.play.chord(chord.tones, 4 * BEAT_S, false), 0.35)
      }
      if (arp > 0) {
        for (const [index, note] of [0, 1, 2, 1].entries()) {
          const hz = (chord.tones[note] ?? chord.root) * arp
          const pan = index % 2 === 0 ? -0.3 : 0.3
          this.music.add(beat + index * 0.25, this.play.pluck(hz), 0.38, pan)
        }
      }
    }
  }

  /** End: one last hit and the chord ringing out under the end card. */
  end(from: number): void {
    this.kick(from)
    this.drums.add(from, this.play.crash(), 0.8)
    const ring = LENGTH_S - from * BEAT_S
    this.music.add(from, this.play.chord(chordAt(from).tones, ring, false), 0.45)
    this.music.add(from, this.play.bass(chordAt(from).root, ring, 600), 0.5)
  }

  crash(beat: number, gain: number): void {
    this.drums.add(beat, this.play.crash(), gain)
  }
}

const SIDECHAIN_DEPTH = 0.6
const SIDECHAIN_RELEASE = 9
const DRIVE = 1.1
// headroom for the effects mixed on top, and for social platforms (−1 dBTP)
const PEAK = 0.7

/** Drums plus the music ducked under every kick (the pump), soft-clipped and normalized. */
function master(song: Song): [Float32Array, Float32Array] {
  const kicks = [...song.kicks].sort((a, b) => a - b).map((beat) => beat * BEAT_S)
  const left = new Float32Array(song.drums.left.length)
  const right = new Float32Array(song.drums.right.length)
  let next = 0
  let lastKick = -Infinity
  for (let index = 0; index < left.length; index += 1) {
    const t = index / RATE
    while (next < kicks.length && (kicks[next] ?? Infinity) <= t) {
      lastKick = kicks[next] ?? lastKick
      next += 1
    }
    const duck = 1 - SIDECHAIN_DEPTH * decay(t - lastKick, SIDECHAIN_RELEASE)
    const mix = (drums: Float32Array, music: Float32Array): number =>
      Math.tanh(DRIVE * ((drums[index] ?? 0) + (music[index] ?? 0) * duck))
    left[index] = mix(song.drums.left, song.music.left)
    right[index] = mix(song.drums.right, song.music.right)
  }
  return normalized([left, right], PEAK)
}

function compose(): Song {
  const song = new Song()
  const drop = startOf('command') + 4
  song.hook(startOf('hook'), startOf('pain'))
  song.pain(startOf('pain'), startOf('turn'))
  song.turn(startOf('turn'), startOf('command'))
  song.build(startOf('command'), drop)
  song.crash(drop, 0.8)
  song.groove(drop, startOf('pick'), 0)
  song.groove(startOf('pick'), startOf('breadth'), 2)
  song.crash(startOf('breadth'), 0.7)
  song.groove(startOf('breadth'), startOf('evolve'), 4)
  song.crash(startOf('evolve'), 0.5)
  song.groove(startOf('evolve'), startOf('end'), 0)
  song.end(startOf('end'))
  return song
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true })
  await writeFile(path.join(OUT, 'music.wav'), wav(master(compose())))
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
