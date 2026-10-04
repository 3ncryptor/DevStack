import { Hero } from '@/components/sections/hero'
import { HowItWorks } from '@/components/sections/how-it-works'
import { ProblemPromise } from '@/components/sections/problem-promise'
import { WorksWith } from '@/components/sections/works-with'

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <WorksWith />
      <ProblemPromise />
    </>
  )
}
