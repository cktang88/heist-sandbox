import type { HeistRecord } from './record'

/**
 * Picks among phrasings so that two heists read differently but the same heist always reads the same: the choice is
 * a hash of the record and of what is being said, never a random roll.
 */
export type Chooser = <T>(key: string, options: readonly T[]) => T

export function chooserFor(record: HeistRecord): Chooser {
  const base = hash(`${record.site}|${record.seconds.toFixed(2)}|${record.beats.length}|${record.beats.map((beat) => beat.kind + beat.t.toFixed(1)).join(',')}`)
  return (key, options) => options[hash(`${base}:${key}`) % options.length]
}

function hash(text: string): number {
  let value = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

/** "4:07" */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** "barely a minute in", "four minutes in": how a reporter dates a moment from the drop. */
export function minutesIn(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  if (minutes < 1) return 'within the first minute'
  if (minutes === 1) return 'a minute in'
  return `${NUMBER_WORDS[minutes] ?? minutes} minutes in`
}

export const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

export function count(value: number, noun: string, plural = `${noun}s`): string {
  return `${NUMBER_WORDS[value] ?? value} ${value === 1 ? noun : plural}`
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
