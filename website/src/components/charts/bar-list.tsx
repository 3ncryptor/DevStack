'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useRef } from 'react'

gsap.registerPlugin(useGSAP, ScrollTrigger)

interface BarRow {
  readonly label: string
  readonly value: number
}

/** A horizontal bar chart whose bars grow in, one after another, when it scrolls into view. */
export function BarList({
  rows,
  unit,
  highlight
}: {
  readonly rows: readonly BarRow[]
  readonly unit: string
  /** The label drawn in the accent colour. */
  readonly highlight?: string
}) {
  const chart = useRef<HTMLOListElement>(null)
  const max = Math.max(...rows.map((row) => row.value))

  useGSAP(
    () => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-bar]', {
          scaleX: 0,
          transformOrigin: 'left',
          duration: 1,
          ease: 'power3.out',
          stagger: 0.07,
          scrollTrigger: { trigger: chart.current, start: 'top 80%' }
        })
      })
    },
    { scope: chart }
  )

  return (
    <ol ref={chart} className="flex flex-col gap-3">
      {rows.map((row) => (
        <li
          key={row.label}
          className="grid grid-cols-[minmax(0,11rem)_1fr_3rem] items-center gap-4"
        >
          <span className="text-muted-foreground truncate font-mono text-xs">{row.label}</span>
          <span className="bg-muted h-2 overflow-hidden rounded-full">
            <span
              data-bar
              className={`block h-full rounded-full ${row.label === highlight ? 'bg-primary' : 'bg-foreground/70'}`}
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </span>
          <span className="text-right font-mono text-sm tabular-nums">
            {row.value}
            <span className="sr-only"> {unit}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
