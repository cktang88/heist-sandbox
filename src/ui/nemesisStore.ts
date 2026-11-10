import { MAX_REMEMBERED, rememberHeist, welcomeReturning } from '../game/people/nemesis'
import { TRAITS } from '../game/people/traits'
import type { Remembered } from '../game/people/types'
import type { World } from '../game/world'

/**
 * Guards who survived the player, kept in browser storage between heists. The simulation stays pure: it is handed
 * the list when a heist starts (`withNemeses`) and asked what to remember when it ends (`rememberNemeses`).
 */

export const NEMESIS_KEY = 'smash-and-grab.nemeses'
const WHATS: readonly Remembered['what'][] = ['spared', 'humiliated', 'wounded', 'saw']

/** Stored text back to records, dropping anything malformed. */
export function parseRemembered(text: string | null): Remembered[] {
  if (!text) return []
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  return data.filter(isRemembered).slice(0, MAX_REMEMBERED)
}

function isRemembered(value: unknown): value is Remembered {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  const text = (key: string) => typeof entry[key] === 'string' && (entry[key] as string).length > 0 && (entry[key] as string).length < 40
  return text('first') && text('last') && text('rank') && text('site') && Number.isInteger(entry.heist)
    && WHATS.includes(entry.what as Remembered['what'])
    && Array.isArray(entry.traits) && entry.traits.length <= 3 && entry.traits.every((trait) => typeof trait === 'string' && trait in TRAITS)
}

export function loadNemeses(): Remembered[] {
  try {
    return parseRemembered(localStorage.getItem(NEMESIS_KEY))
  } catch {
    return []
  }
}

function saveNemeses(list: Remembered[]): void {
  try {
    localStorage.setItem(NEMESIS_KEY, JSON.stringify(list))
  } catch {
    // Storage refused: nobody comes back next time, which is no worse than a first heist.
  }
}

/** For main.ts, around every new world: puts returning guards from earlier heists on its roster. */
export function withNemeses(world: World): World {
  welcomeReturning(world, loadNemeses())
  return world
}

const remembered = new WeakSet<World>()

/** For main.ts, after every step: once the heist is over, stores who will remember the player. */
export function rememberNemeses(world: World): void {
  if (world.status === 'playing' || remembered.has(world)) return
  remembered.add(world)
  saveNemeses(rememberHeist(world, loadNemeses()))
}
