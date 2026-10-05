/**
 * Synthesizes the film's sound effects (plan: the film, sound) as WAV files, so every sound in
 * it is ours: `npm run film:sfx` → src/film/audio/{click,tick,chime,impact,whoosh,glitch}.wav.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { decay, noise, OnePole, sine, sound, wav } from './audio'

const OUT = path.join(process.cwd(), 'src/film/audio')
const WHOOSH_S = 0.8

/** Noise that opens up and closes again: the swish between acts. */
function whoosh(): Float32Array {
  const filter = new OnePole()
  const swell = (t: number): number => Math.sin((Math.PI * t) / WHOOSH_S)
  return sound(WHOOSH_S, (t) => filter.lowPass(noise(), 300 + 6000 * swell(t)) * swell(t) ** 2)
}

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
  whoosh: whoosh(),
  // the pain montage: stuttering square bursts that jump in pitch
  glitch: sound(0.25, (t) => {
    const hz = 90 + 60 * (Math.floor(t * 40) % 7)
    const gate = Math.floor(t * 60) % 2
    return Math.sign(sine(t, hz)) * gate * decay(t, 8) * 0.3
  })
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true })
  for (const [name, samples] of Object.entries(SOUNDS)) {
    await writeFile(path.join(OUT, `${name}.wav`), wav([samples]))
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
