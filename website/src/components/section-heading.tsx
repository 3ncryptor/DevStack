import { Reveal } from '@/components/motion/reveal'
import { TextScramble } from '@/components/motion/text-scramble'

/** A landing section's mono eyebrow, decoding in, over its headline. */
export function SectionHeading({
  eyebrow,
  title
}: {
  readonly eyebrow: string
  readonly title: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <TextScramble text={`// ${eyebrow}`} className="text-primary font-mono text-sm" />
      <Reveal>
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      </Reveal>
    </div>
  )
}
