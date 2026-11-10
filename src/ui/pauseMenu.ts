import { h, keyCaps, panel } from './dom'

export type PauseActions = {
  resume(): void
  controls(): void
  help(): void
  settings(): void
  sameSeed(): void
  newSeed(): void
}

function item(label: string, key: string | null, action: () => void, extra = ''): HTMLButtonElement {
  return h('button', { class: `sg-item ${extra}`, attrs: { type: 'button' }, on: { click: action } }, h('span', { text: label }), key ? keyCaps(key) : null)
}

/** The pause menu: what to do next, and which heist this is. */
export function pauseMenu(seed: number, site: string, actions: PauseActions): HTMLElement {
  const resume = item('Resume', 'Esc', actions.resume, 'sg-primary')
  resume.dataset.autofocus = ''
  const body = h('div', { class: 'sg-body sg-pause' },
    h('nav', { class: 'sg-items' },
      resume,
      item('Controls', 'K', actions.controls),
      item('Help', 'H', actions.help),
      item('Settings', null, actions.settings),
      h('div', { class: 'sg-rule' }),
      item('New heist, same seed', null, actions.sameSeed),
      item('New heist, new seed', null, actions.newSeed),
    ),
    h('p', { class: 'sg-seed' }, h('span', { text: 'SEED' }), h('b', { text: String(seed) }), h('span', { text: site.toUpperCase() })),
  )
  return panel('Paused', '// SYS.HOLD', body)
}
