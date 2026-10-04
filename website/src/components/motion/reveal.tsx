'use client'

import { motion, type HTMLMotionProps } from 'motion/react'

import { DURATION, EASE, STAGGER } from '@/lib/motion'

const RISE = 16

/** Fades and rises its children in the first time they scroll into view. */
export function Reveal({ delay = 0, ...props }: HTMLMotionProps<'div'> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: RISE }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: DURATION.reveal, ease: EASE, delay }}
      {...props}
    />
  )
}

/** Reveals each child in turn; children must be `StaggerItem`s. */
export function Stagger(props: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ staggerChildren: STAGGER }}
      {...props}
    />
  )
}

export function StaggerItem(props: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: RISE }, shown: { opacity: 1, y: 0 } }}
      transition={{ duration: DURATION.reveal, ease: EASE }}
      {...props}
    />
  )
}
