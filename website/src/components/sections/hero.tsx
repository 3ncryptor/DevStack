import { PACKAGE_MANAGERS } from '@repo/src/browser'

import { VideoHero } from '@/components/hero/video-hero'
import { registry } from '@/lib/registry'
import { REPOSITORY } from '@/lib/site'

import cliPackage from '@repo/package.json'

/** Section 1: the full-screen film, scrolled away into the command and GitHub (VideoHero). */
export function Hero() {
  return (
    <VideoHero
      command={`npx ${cliPackage.name} my-app`}
      modules={registry.size}
      packageManagers={PACKAGE_MANAGERS.length}
      repository={REPOSITORY}
    />
  )
}
