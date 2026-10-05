'use client'

import { motion } from 'motion/react'

import type { FormQuestion } from '@repo/src/browser'

import { BrandLogo } from '@/components/brand-logo'
import { MODULE_LOGOS } from '@/lib/logos'
import { DURATION } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface Option {
  readonly value: string
  readonly label: string
  readonly hint?: string
}

/** One answer as a chip: springs when chosen, shows the module's logo when it has one. */
function Chip({
  option,
  on,
  onToggle
}: {
  readonly option: Option
  readonly on: boolean
  readonly onToggle: () => void
}) {
  const logo = MODULE_LOGOS[option.value]
  return (
    <motion.button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: DURATION.micro }}
      title={option.hint}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
        on
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border text-muted-foreground hover:text-foreground hover:border-white/20'
      )}
    >
      {logo !== undefined && <BrandLogo icon={logo} className="size-4 shrink-0" />}
      <span>{option.label}</span>
    </motion.button>
  )
}

const YES_NO: readonly Option[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' }
]

/** A wizard question as the CLI asks it, answered with chips instead of arrow keys. */
export function QuestionField({
  question,
  onAnswer
}: {
  readonly question: FormQuestion
  readonly onAnswer: (value: unknown) => void
}) {
  return (
    <fieldset className="border-border flex flex-col gap-3 border-t py-6 first:border-t-0 first:pt-0">
      <legend className="sr-only">{question.message}</legend>
      {question.label !== question.message && (
        <p className="label text-muted-foreground">{question.label}</p>
      )}
      <p className="text-sm">{question.message}</p>
      <div className="flex flex-wrap gap-2">
        {question.kind === 'select' &&
          question.choices.map((choice) => (
            <Chip
              key={choice.value}
              option={choice}
              on={question.value === choice.value}
              onToggle={() => onAnswer(choice.value)}
            />
          ))}
        {question.kind === 'multiselect' &&
          question.choices.map((choice) => {
            const on = question.value.includes(choice.value)
            return (
              <Chip
                key={choice.value}
                option={choice}
                on={on}
                onToggle={() =>
                  onAnswer(
                    on
                      ? question.value.filter((value) => value !== choice.value)
                      : [...question.value, choice.value]
                  )
                }
              />
            )
          })}
        {question.kind === 'confirm' &&
          YES_NO.map((option) => (
            <Chip
              key={option.value}
              option={option}
              on={question.value === (option.value === 'yes')}
              onToggle={() => onAnswer(option.value === 'yes')}
            />
          ))}
      </div>
    </fieldset>
  )
}
