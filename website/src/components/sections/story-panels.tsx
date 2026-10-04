'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'

import { TerminalWindow } from '@/components/terminal-window'
import { FileTree } from '@/components/ui/file-tree'
import { CHECKS, FILM_DATA } from '@/film/film-data'
import { folderIds, treeOf } from '@/lib/file-tree'
import { DURATION, EASE, STAGGER } from '@/lib/motion'

const { projectName, packageName, answers, files, evolve } = FILM_DATA
const TITLE = `~/projects/${projectName}`
const LINE_STAGGER = STAGGER * 2

/** Lines that appear one after another when the panel mounts. */
function Lines({ children, delay = 0 }: { readonly children: ReactNode; readonly delay?: number }) {
  return (
    <motion.ul
      className="flex flex-col gap-1.5"
      initial="hidden"
      animate="shown"
      transition={{ staggerChildren: LINE_STAGGER, delayChildren: delay }}
    >
      {children}
    </motion.ul>
  )
}

function Line({ children }: { readonly children: ReactNode }) {
  return (
    <motion.li
      variants={{ hidden: { opacity: 0, x: -8 }, shown: { opacity: 1, x: 0 } }}
      transition={{ duration: DURATION.ui, ease: EASE }}
    >
      {children}
    </motion.li>
  )
}

function Prompt({ command }: { readonly command: string }) {
  return (
    <p className="mb-4">
      <span className="text-primary">$ </span>
      {command}
    </p>
  )
}

/** A file tree that scrolls inside the panel instead of moving the page. */
function ScrollingTree({
  paths,
  open,
  icon
}: {
  readonly paths: readonly string[]
  readonly open: 'top' | 'all'
  readonly icon?: (path: string) => ReactNode
}) {
  const nodes = treeOf(paths, icon)
  const expanded = open === 'all' ? folderIds(nodes) : nodes.map((node) => node.id)
  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
      <FileTree
        data={nodes}
        defaultExpandedIds={expanded}
        selectable={false}
        className="font-mono"
      />
    </div>
  )
}

export function PickPanel() {
  return (
    <TerminalWindow title={TITLE} className="h-full">
      <Prompt command={`npx ${packageName} ${projectName}`} />
      <Lines>
        {answers.map(({ question, answer }) => (
          <Line key={question}>
            <span className="text-primary">✔ </span>
            {question} <span className="text-muted-foreground">· {answer}</span>
          </Line>
        ))}
      </Lines>
    </TerminalWindow>
  )
}

export function GeneratePanel() {
  return (
    <TerminalWindow title={TITLE} className="h-full">
      <div className="flex h-full flex-col">
        <p className="mb-3">
          <span className="text-primary">✔ </span>
          {files.length} files planned{' '}
          <span className="text-muted-foreground">· wired together</span>
        </p>
        <ScrollingTree paths={files} open="top" />
      </div>
    </TerminalWindow>
  )
}

export function VerifyPanel() {
  return (
    <TerminalWindow title={TITLE} className="h-full">
      <p className="text-muted-foreground mb-2">installing with pnpm…</p>
      <div className="bg-muted mb-5 h-1.5 overflow-hidden rounded-full">
        <motion.div
          className="bg-primary h-full origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.2, ease: EASE }}
        />
      </div>
      <p className="text-muted-foreground mb-2">checking the project</p>
      <Lines delay={1.2}>
        {CHECKS.map((gate) => (
          <Line key={gate}>
            <span className="text-primary">✓ </span>
            {gate}
          </Line>
        ))}
      </Lines>
    </TerminalWindow>
  )
}

const ADDED = new Set(evolve.added)

const changeMark = (path: string): ReactNode =>
  ADDED.has(path) ? (
    <span className="text-primary">+</span>
  ) : (
    <span className="text-warning">~</span>
  )

export function EvolvePanel() {
  return (
    <TerminalWindow title={TITLE} className="h-full">
      <div className="flex h-full flex-col">
        <Prompt command={`npx ${packageName} add ${evolve.module}`} />
        <p className="mb-3">
          <span className="text-primary">+{evolve.added.length} new</span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-warning">~{evolve.changed.length} rewired</span>
        </p>
        <ScrollingTree paths={[...evolve.added, ...evolve.changed]} open="all" icon={changeMark} />
      </div>
    </TerminalWindow>
  )
}
