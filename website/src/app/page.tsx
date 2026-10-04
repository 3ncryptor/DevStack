import { Hero } from '@/components/sections/hero'
import { ProblemPromise } from '@/components/sections/problem-promise'
import { WorksWith } from '@/components/sections/works-with'

export default function Home() {
  return (
    <>
      <Hero />
      <WorksWith />
      <ProblemPromise />
    </>
  )
}
