'use client'

import dynamic from 'next/dynamic'

/** Holds the #build anchor and the space while the builder loads, so links land and nothing jumps. */
function BuilderPlaceholder() {
  return (
    <section
      id="build"
      aria-label="Build your stack"
      className="mx-auto min-h-svh max-w-6xl px-6 py-28"
    >
      <p className="label text-muted-foreground">{'// loading the builder…'}</p>
    </section>
  )
}

/**
 * The builder runs in the browser only: it reads the share link and the visitor's OS, and
 * computes everything from DevStack's own code, so there is nothing to render on the server.
 */
export const BuilderLoader = dynamic(() => import('./builder').then((module) => module.Builder), {
  ssr: false,
  loading: BuilderPlaceholder
})
