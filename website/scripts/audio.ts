/**
 * The film's synthesizer basics, shared by make-sfx.ts and make-music.ts: oscillators, seeded
 * noise (so every render sounds the same), a one-pole filter and a WAV writer.
 */
export const RATE = 48_000

/** mulberry32: noise from a seed, so a render is repeatable. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const random = seeded(2025)

export const noise = (): number => random() * 2 - 1
export const sine = (t: number, hz: number): number => Math.sin(2 * Math.PI * hz * t)
export const decay = (t: number, rate: number): number => Math.exp(-t * rate)

/** A mono sound as samples in −1…1, `seconds` long, from a function of time. */
export const sound = (seconds: number, sample: (t: number) => number): Float32Array =>
  Float32Array.from({ length: Math.round(seconds * RATE) }, (_, index) => sample(index / RATE))

/** A one-pole low-pass filter; `highPass` returns what the low-pass removes. */
export class OnePole {
  private last = 0

  /** Feeds one sample through with the cutoff in Hz (which may change every sample). */
  lowPass(input: number, cutoffHz: number): number {
    this.last += (1 - Math.exp((-2 * Math.PI * cutoffHz) / RATE)) * (input - this.last)
    return this.last
  }

  highPass(input: number, cutoffHz: number): number {
    return input - this.lowPass(input, cutoffHz)
  }
}

/** 16-bit PCM WAV, channels interleaved (one channel for mono, two for stereo). */
export function wav(channels: readonly Float32Array[]): Buffer {
  const frames = channels[0]?.length ?? 0
  const data = Buffer.alloc(frames * channels.length * 2)
  for (let frame = 0; frame < frames; frame += 1) {
    channels.forEach((channel, index) => {
      const value = Math.max(-1, Math.min(1, channel[frame] ?? 0))
      data.writeInt16LE(Math.round(value * 32_767), (frame * channels.length + index) * 2)
    })
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels.length, 22)
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * channels.length * 2, 28)
  header.writeUInt16LE(channels.length * 2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}
