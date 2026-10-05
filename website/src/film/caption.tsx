import { spring, useCurrentFrame, useVideoConfig } from 'remotion'

const FIRST_WORD_AT = 6
const WORD_EVERY = 3
const RISE_PX = 40

interface Word {
  readonly text: string
  readonly highlighted: boolean
}

/** `Or *one command.*` → words, those between asterisks highlighted. */
function wordsOf(caption: string): Word[] {
  return caption
    .split(/(\*[^*]+\*)/)
    .filter((segment) => segment !== '')
    .flatMap((segment) => {
      const highlighted = segment.startsWith('*')
      return segment
        .replaceAll('*', '')
        .split(' ')
        .filter((text) => text !== '')
        .map((text) => ({ text, highlighted }))
    })
}

/** The bottom-third line: words spring up one after another, so the film works muted. */
export function Caption({ text }: { readonly text: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <div className="display absolute inset-x-0 bottom-[80px] flex flex-wrap justify-center gap-x-[0.3em] px-24 text-center text-[54px] uppercase">
      {wordsOf(text).map((word, index) => {
        const shown = spring({
          frame: frame - FIRST_WORD_AT - index * WORD_EVERY,
          fps,
          config: { damping: 18 }
        })
        return (
          <span
            key={index}
            className={word.highlighted ? 'text-primary' : 'text-foreground'}
            style={{ opacity: shown, transform: `translateY(${(1 - shown) * RISE_PX}px)` }}
          >
            {word.text}
          </span>
        )
      })}
    </div>
  )
}
