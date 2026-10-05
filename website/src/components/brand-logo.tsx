import type { SimpleIcon } from 'simple-icons'

/** A Simple Icons brand logo, drawn in the current text colour. */
export function BrandLogo({
  icon,
  className
}: {
  readonly icon: SimpleIcon
  readonly className?: string
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d={icon.path} />
    </svg>
  )
}
