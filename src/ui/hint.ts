import { h, keyCaps } from './dom'

const HINT_SECONDS = 8

let shown = false

/**
 * A quiet line at the top for the first seconds of the first heist, so a new player knows where the menus are.
 * Called when play starts: shown earlier, it faded out unseen behind the 3D view's loading screen.
 */
export function showHint(): void {
  if (shown) return
  shown = true
  const hint = h('div', { class: 'sg-hint', attrs: { 'aria-hidden': 'true' } },
    h('span', {}, keyCaps('Esc'), ' menu'), h('span', {}, keyCaps('H'), ' help'), h('span', {}, keyCaps('K'), ' controls'))
  hint.style.animationDuration = `${HINT_SECONDS}s`
  hint.addEventListener('animationend', () => hint.remove())
  document.body.append(hint)
}
