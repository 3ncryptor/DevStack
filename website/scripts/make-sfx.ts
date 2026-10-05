/**
 * Synthesizes the film's sound effects (plan: the film, sound) as WAV files, so every sound in
 * it is ours: `npm run film:sfx` → src/film/audio/{click,tick,chime,impact,whoosh,glitch}.wav.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const RATE = 48_000
const OUT = path.join(process.cwd(), 'src/film/audio')

/** A mono sound as samples in −1…1, `seconds` long, from a function of time. */
const sound = (seconds: number, sample: (t: number) => number): Float32Array =>
  Float32Array.from({ length: Math.round(seconds * RATE) }, (_, index) => sample(index / RATE))

const decay = (t: number, rate: number): number => Math.exp(-t * rate)
const sine = (t: number, hz: number): number => Math.sin(2 * Math.PI * hz * t)
const noise = (): number => Math.random() * 2 - 1

/** Noise through a one-pole low-pass whose cutoff follows `cutoff(t)` (0…1). */
function filteredNoise(
  seconds: number,
  cutoff: (t: number) => number,
  gain: (t: number) => number
): Float32Array {
  let last = 0
  return sound(seconds, (t) => {
    last += cutoff(t) * (noise() - last)
    return last * gain(t)
  })
}

const WHOOSH_S = 0.8

const SOUNDS: Record<string, Float32Array> = {
  // a mechanical key: a bright noise snap
  click: sound(0.03, (t) => noise() * decay(t, 260) * 0.5),
  // a check landing: a short high blip
  tick: sound(0.12, (t) => sine(t, 1760) * decay(t, 45) * 0.45),
  // success: a fifth, ringing out
  chime: sound(
    1.2,
    (t) => (sine(t, 880) + 0.6 * sine(t, 1320) + 0.3 * sine(t, 1760)) * decay(t, 4) * 0.3
  ),
  // the drop on Enter and on each logo wall: a falling sub hit with a noise transient
  impact: sound(0.9, (t) => {
    const hz = 40 + 110 * decay(t, 9)
    return (sine(t, hz) * decay(t, 4.5) + noise() * decay(t, 70) * 0.4) * 0.85
  }),
  // a swish between acts: noise that opens up and closes again
  whoosh: filteredNoise(
    WHOOSH_S,
    (t) => 0.02 + 0.25 * Math.sin((Math.PI * t) / WHOOSH_S),
    (t) => Math.sin((Math.PI * t) / WHOOSH_S) ** 2 * 0.9
  ),
  // the pain montage: stuttering square bursts that jump in pitch
  glitch: sound(0.25, (t) => {
    const hz = 90 + 60 * (Math.floor(t * 40) % 7)
    const gate = Math.floor(t * 60) % 2
    return Math.sign(sine(t, hz)) * gate * decay(t, 8) * 0.3
  })
}

/** 16-bit PCM mono WAV. */
function wav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((value, index) =>
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32_767), index * 2)
  )
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true })
  for (const [name, samples] of Object.entries(SOUNDS)) {
    await writeFile(path.join(OUT, `${name}.wav`), wav(samples))
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
