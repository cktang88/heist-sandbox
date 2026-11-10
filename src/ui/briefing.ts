import { nightConditions } from '../game/director/director'
import type { World } from '../game/world'
import { h } from './dom'
import './debrief.css'

/**
 * Tonight's conditions, one line each: shown as a card for the first seconds of a heist so the player can plan, and
 * as a block the pause menu can show (`tonightBlock`).
 */

const CARD_SECONDS = 16

export function showBriefing(world: World): void {
  hideBriefing()
  const lines = nightConditions(world)
  if (lines.length === 0) return
  const card = h('div', { class: 'sg-ui sg-briefing', attrs: { 'aria-live': 'polite' } },
    h('div', { class: 'sg-briefing-head' }, h('b', { text: 'TONIGHT' }), h('span', { text: `// ${world.name.toUpperCase()}` })),
    h('ul', {}, ...lines.map((line) => h('li', { text: line }))))
  card.style.animationDuration = `${CARD_SECONDS}s`
  card.addEventListener('animationend', () => card.remove())
  document.body.append(card)
}

/** Takes the card away early: once the heist is over it would sit stale over the end screen. */
export function hideBriefing(): void {
  document.querySelector('.sg-briefing')?.remove()
}

/** The same lines as a block for a menu. Empty when the director is off. */
export function tonightBlock(world: World): HTMLElement | null {
  const lines = nightConditions(world)
  if (lines.length === 0) return null
  return h('div', { class: 'sg-tonight-block' }, h('h3', { text: 'Tonight' }), h('ul', { class: 'sg-tonight' }, ...lines.map((line) => h('li', { text: line }))))
}
