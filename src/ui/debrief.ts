import { debriefText, type Debrief } from '../game/chronicle/chronicle'
import { h, panel } from './dom'
import type { PastHeist } from './debriefStore'
import { pastHeists } from './debriefStore'
import './debrief.css'

/**
 * The debrief at the end of a heist: a newspaper clipping of what happened (headline, story, a stamp with the verdict)
 * pinned beside the dossier numbers and highlights, with buttons for the next heist and for copying the story.
 */

export type DebriefActions = { sameSeed(): void; newSeed(): void }

const STAMP_TONES = { ghost: 'quiet', quiet: 'quiet', loud: 'loud', catastrophe: 'loud' } as const

/** Shows the debrief over everything. Returns a function that takes it away. */
export function showDebrief(entry: PastHeist, actions: DebriefActions): () => void {
  const same = button('New heist (same seed)', actions.sameSeed, true)
  const fresh = button('New heist (new seed)', actions.newSeed)
  const sheet = debriefPanel(entry, [same, fresh, copyButton(entry.debrief)])
  const root = h('div', { class: 'sg-ui sg-open sg-debrief-root' }, h('div', { class: 'sg-layer sg-debrief-layer' }, sheet))
  // Keys pressed in the debrief are its own: the game behind must not restart or pause on them.
  // Esc puts it away, leaving the end screen underneath (where Enter still starts a new heist).
  const close = () => root.remove()
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') trapTab(root, event)
    if (event.key === 'Escape') close()
    event.stopPropagation()
  })
  document.body.append(root)
  // Without preventScroll a short window scrolls down to the buttons and the headline starts out of sight.
  same.focus({ preventScroll: true })
  return close
}

/** The pause menu's list of the last few heists; picking one shows its debrief in place. */
export function pastHeistsModal(): HTMLElement {
  const body = h('div', { class: 'sg-body sg-past' })
  const list = () => {
    reading = false
    const entries = pastHeists()
    if (entries.length === 0) {
      body.replaceChildren(h('p', { class: 'sg-past-empty', text: 'No heists on file yet. Finish one, win or lose, and its story is kept here.' }))
      return
    }
    body.replaceChildren(h('nav', { class: 'sg-items' }, ...entries.map((entry, index) => {
      const item = h('button', { class: 'sg-item sg-past-item', attrs: { type: 'button' }, on: { click: () => open(entry) } },
        h('span', { text: entry.debrief.headline }), h('small', { text: `${entry.debrief.verdict.word} · ${entry.site} ${entry.seed} · ${entry.when}` }))
      if (index === 0) item.dataset.autofocus = ''
      return item
    })))
    body.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }
  let reading = false
  // Esc while reading one story goes back to the list, one step, like every other screen; on the list it closes.
  body.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !reading) return
    event.stopPropagation()
    list()
  })
  const open = (entry: PastHeist) => {
    reading = true
    const back = button('Back to the list', list, true)
    body.replaceChildren(debriefPanel(entry, [back, copyButton(entry.debrief)], true))
    back.focus({ preventScroll: true })
    body.scrollTop = 0
  }
  list()
  return panel('Past heists', '// CASE.FILES', body, true)
}

/** A pause-menu entry that opens the past heists. */
export function pastHeistsButton(open: () => void): HTMLButtonElement {
  return h('button', { class: 'sg-item', attrs: { type: 'button' }, on: { click: open } }, h('span', { text: 'Past heists' }))
}

function debriefPanel(entry: PastHeist, buttons: HTMLElement[], embedded = false): HTMLElement {
  const debrief = entry.debrief
  const tone = debrief.outcome === 'dead' ? 'loud' : STAMP_TONES[debrief.verdict.style]
  const clipping = h('article', { class: 'sg-clip' },
    h('p', { class: 'sg-clip-masthead', text: 'THE NIGHT EDITION' }),
    h('p', { class: 'sg-clip-dateline', text: debrief.dateline }),
    h('h1', { class: 'sg-clip-headline', text: debrief.headline }),
    h('div', { class: 'sg-clip-story' }, ...paragraphs(debrief.story).map((text) => h('p', { text }))),
    h('div', { class: `sg-stamp sg-stamp-${tone}`, text: debrief.outcome === 'dead' ? 'K.I.A.' : debrief.verdict.word.split(',')[0] }),
  )
  const numbers = h('dl', { class: 'sg-dossier-numbers' }, ...debrief.numbers.flatMap((entry) => [h('dt', { text: entry.label }), h('dd', { text: entry.value })]))
  const dossier = h('aside', { class: 'sg-dossier' },
    h('h3', { text: 'Verdict' }),
    h('p', { class: `sg-verdict sg-tone-${tone}` }, h('b', { text: debrief.verdict.word }), ' ', debrief.verdict.line),
    h('h3', { text: 'The numbers' }), numbers,
    debrief.highlights.length > 0 ? h('h3', { text: 'Highlights' }) : null,
    debrief.highlights.length > 0 ? h('ul', { class: 'sg-highlights' }, ...debrief.highlights.map((line) => h('li', { text: line }))) : null,
    debrief.briefing.length > 0 ? h('h3', { text: 'Tonight' }) : null,
    debrief.briefing.length > 0 ? h('ul', { class: 'sg-tonight' }, ...debrief.briefing.map((line) => h('li', { text: line }))) : null,
    h('p', { class: 'sg-seed' }, h('span', { text: 'SEED' }), h('b', { text: String(entry.seed) }), h('span', { text: entry.site.toUpperCase() })),
  )
  const body = h('div', { class: 'sg-debrief-body' }, clipping, dossier)
  const actions = h('div', { class: 'sg-debrief-actions' }, ...buttons)
  if (embedded) return h('div', { class: 'sg-debrief sg-embedded' }, body, actions)
  const outcome = debrief.outcome === 'won' ? 'Job done' : debrief.outcome === 'dead' ? 'Operative down' : 'Debrief'
  return panel(outcome, '// AFTER.ACTION', h('div', { class: 'sg-body sg-debrief' }, body, actions), true)
}

/** Two paragraphs read better than one block: the first half of the story, then the rest. */
function paragraphs(story: string[]): string[] {
  if (story.length < 5) return [story.join(' ')]
  const half = Math.ceil(story.length / 2)
  return [story.slice(0, half).join(' '), story.slice(half).join(' ')]
}

function button(label: string, action: () => void, primary = false): HTMLButtonElement {
  return h('button', { class: `sg-btn${primary ? ' sg-primary' : ''}`, text: label, attrs: { type: 'button' }, on: { click: action } })
}

function copyButton(debrief: Debrief): HTMLButtonElement {
  const copy = button('Copy story', () => {
    const text = debriefText(debrief)
    const done = () => {
      copy.textContent = 'Copied'
      setTimeout(() => (copy.textContent = 'Copy story'), 1600)
    }
    navigator.clipboard?.writeText(text).then(done, () => fallbackCopy(text, done)) ?? fallbackCopy(text, done)
  })
  return copy
}

/** Where the clipboard API is refused (an insecure page, an old browser), a hidden text area and the copy command. */
function fallbackCopy(text: string, done: () => void): void {
  const area = h('textarea', { class: 'sg-copy-area' })
  area.value = text
  document.body.append(area)
  area.select()
  if (document.execCommand('copy')) done()
  area.remove()
}

function trapTab(root: HTMLElement, event: KeyboardEvent): void {
  const items = [...root.querySelectorAll<HTMLElement>('button')]
  const at = items.indexOf(document.activeElement as HTMLElement)
  const next = event.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : (at + 1) % items.length
  items[next]?.focus()
  event.preventDefault()
}
