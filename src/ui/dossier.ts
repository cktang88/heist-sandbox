import type { DossierCard } from '../game/people/dossier'
import { h, panel } from './dom'

/**
 * The dossier screen: one block per guard the player has met, in the controls screen's layout (columns of
 * groups, each a heading over term and text pairs), so it needs no styles of its own.
 */

function row(term: string, text: string | null): HTMLElement[] {
  return text ? [h('dt', { text: term }), h('dd', { text })] : []
}

function card(entry: DossierCard): HTMLElement {
  return h('section', { class: 'sg-group' },
    h('h3', { text: entry.name }),
    h('dl', {},
      ...row('Rank', entry.rank),
      ...row('Status', entry.status),
      ...row('File', entry.background),
      ...row('Seen to be', entry.traits.join(', ') || null),
      ...row('Knows', entry.bonds.join('; ') || null),
      ...row('Tonight', entry.tonight.join('. ') || null),
      ...row('History', entry.history),
    ),
  )
}

export function dossierModal(cards: DossierCard[]): HTMLElement {
  const body = cards.length > 0
    ? h('div', { class: 'sg-body sg-controls', attrs: { tabindex: '0' } }, ...cards.map(card))
    : h('div', { class: 'sg-body', attrs: { tabindex: '0' } }, h('p', { text: 'Nobody yet. Get close to a guard, question one, or search one who is out cold.' }))
  body.dataset.autofocus = ''
  return panel('Dossier', '// PERSONNEL', body, true)
}
