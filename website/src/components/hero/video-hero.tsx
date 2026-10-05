'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { CopyCommand } from '@/components/copy-command'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const COLUMNS = 8
const WORDMARK = 'DEVSTACK'
/** How far the page scrolls while the hero stays pinned, as a share of the viewport. */
const PIN_LENGTH = '+=180%'

interface VideoHeroProps {
  readonly command: string
  readonly modules: number
  readonly packageManagers: number
  readonly repository: string
}

/** Muted autoplay is all browsers allow; this turns the film's sound on and off. */
function SoundToggle({ on, onToggle }: { readonly on: boolean; readonly onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? 'Mute the film' : 'Play the film with sound'}
      className="border-border/60 bg-background/40 text-foreground hover:bg-background/70 absolute right-6 bottom-6 z-10 grid size-11 place-items-center rounded-full border backdrop-blur transition-colors"
    >
      {on ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
    </button>
  )
}

/**
 * Section 1: the film fills the screen with no calls to action. Scrolling pins it while black
 * columns drop over it (after neutronfest.org), the wordmark rises, then the command to copy and
 * the GitHub link: a GSAP ScrollTrigger timeline scrubbed by the scroll.
 */
export function VideoHero({ command, modules, packageManagers, repository }: VideoHeroProps) {
  const stage = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [sound, setSound] = useState(false)

  // React does not keep a video's `muted` property in sync with the attribute, so set it here.
  useEffect(() => {
    if (video.current !== null) video.current.muted = !sound
  }, [sound])

  useGSAP(
    () => {
      const media = gsap.matchMedia()
      media.add('(prefers-reduced-motion: no-preference)', () => {
        // Start clean: a previous run (React re-mounts in development) must not leave offsets.
        gsap.set('[data-column], [data-letter], [data-cta]', { clearProps: 'transform' })
        gsap
          .timeline({
            scrollTrigger: {
              trigger: stage.current,
              start: 'top top',
              end: PIN_LENGTH,
              pin: true,
              scrub: 0.6
            }
          })
          .fromTo(
            '[data-column]',
            {
              scaleY: 0,
              transformOrigin: (index: number) => (index % 2 === 0 ? 'top' : 'bottom'),
              autoAlpha: 1
            },
            { scaleY: 1, stagger: 0.04, ease: 'power2.in' }
          )
          .to('[data-film]', { scale: 1.08, filter: 'blur(6px)' }, 0)
          .to('[data-status]', { opacity: 0 }, 0)
          .fromTo(
            '[data-letter]',
            { yPercent: 110, autoAlpha: 1 },
            { yPercent: 0, stagger: 0.03, ease: 'power3.out' }
          )
          .fromTo('[data-cta]', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, stagger: 0.08 })
      })
      // Reduced motion: no pin and no scrub; the finished state sits over the poster.
      media.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set('[data-column]', { autoAlpha: 1 })
        gsap.set('[data-status]', { opacity: 0 })
        gsap.set('[data-letter]', { autoAlpha: 1 })
        gsap.set('[data-cta]', { autoAlpha: 1 })
      })
    },
    { scope: stage }
  )

  return (
    <section aria-label="DevStack" className="relative">
      <div ref={stage} className="relative h-svh overflow-hidden bg-black">
        <video
          ref={video}
          data-film
          className="absolute inset-0 size-full object-contain sm:object-cover"
          src="/film/devstack.mp4"
          poster="/film/poster.jpeg"
          autoPlay
          muted
          loop
          playsInline
          aria-label="The DevStack film: one command builds, checks and boots a full stack"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0_3px,rgb(0_0_0/0.18)_3px_4px)]"
        />
        <p data-status className="label text-muted-foreground absolute bottom-7 left-6">
          {modules} modules · {packageManagers} package managers
        </p>
        <p
          data-status
          className="label text-muted-foreground absolute bottom-7 left-1/2 -translate-x-1/2 max-sm:hidden"
        >
          scroll to enter
        </p>
        <SoundToggle on={sound} onToggle={() => setSound(!sound)} />

        <div aria-hidden className="pointer-events-none absolute inset-0 flex">
          {Array.from({ length: COLUMNS }, (_, column) => (
            <div key={column} data-column className="invisible -mx-px h-full flex-1 bg-black" />
          ))}
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-6 text-center">
          <h1 className="display flex overflow-hidden text-[11.5vw] leading-none sm:text-[13vw]">
            {[...WORDMARK].map((letter, index) => (
              <span key={index} data-letter aria-hidden className="invisible inline-block">
                {letter}
              </span>
            ))}
            <span className="sr-only">DevStack: production-ready stacks, wired and verified</span>
          </h1>
          <p data-cta className="label text-muted-foreground invisible opacity-0">
            production-ready stacks · wired and verified
          </p>
          <div
            data-cta
            className="invisible flex max-w-full flex-col items-center gap-4 opacity-0 sm:flex-row"
          >
            <CopyCommand command={command} />
            <a
              href={repository}
              className="bg-primary text-primary-foreground rounded-lg px-5 py-3 font-mono text-sm font-semibold transition-transform hover:-translate-y-0.5"
            >
              ★ star on github
            </a>
            <a
              href="#build"
              className="text-muted-foreground hover:text-foreground font-mono text-sm transition-colors"
            >
              build your stack ↓
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
