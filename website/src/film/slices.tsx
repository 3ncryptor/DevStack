import { AbsoluteFill } from 'remotion'

const COLUMNS = 8
const STAGGER = 0.06

/**
 * Neutron's column cut: black columns drop over the picture, each a little after the last;
 * `progress` 0 shows the picture, 1 is all black.
 */
export function Slices({ progress }: { readonly progress: number }) {
  return (
    <AbsoluteFill className="flex-row">
      {Array.from({ length: COLUMNS }, (_, column) => {
        const start = column * STAGGER
        const local = Math.min(1, Math.max(0, (progress - start) / (1 - STAGGER * (COLUMNS - 1))))
        const fromTop = column % 2 === 0
        return (
          <div
            key={column}
            className="h-full flex-1 bg-black"
            style={{ transform: `translateY(${(1 - local) * (fromTop ? -100 : 100)}%)` }}
          />
        )
      })}
    </AbsoluteFill>
  )
}
