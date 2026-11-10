import { h, keyCaps } from './dom'

const HINT_SECONDS = 8

/** A quiet line at the top for the first seconds, so a new player knows where the menus are. */
export function showHint(): void {
  const hint = h('div', { class: 'sg-hint', attrs: { 'aria-hidden': 'true' } },
    h('span', {}, keyCaps('Esc'), ' menu'), h('span', {}, keyCaps('H'), ' help'), h('span', {}, keyCaps('K'), ' controls'))
  hint.style.animationDuration = `${HINT_SECONDS}s`
  hint.addEventListener('animationend', () => hint.remove())
  document.body.append(hint)
}
