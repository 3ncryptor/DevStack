import { BuilderLoader } from '@/components/builder/builder-loader'
import { Bento } from '@/components/sections/bento'
import { Hero } from '@/components/sections/hero'
import { Mcp } from '@/components/sections/mcp'
import { ProblemPromise } from '@/components/sections/problem-promise'
import { Stats } from '@/components/sections/stats'
import { WorksWith } from '@/components/sections/works-with'

export default function Home() {
  return (
    <>
      <Hero />
      <WorksWith />
      <ProblemPromise />
      <Bento />
      <Stats />
      <Mcp />
      <BuilderLoader />
    </>
  )
}
