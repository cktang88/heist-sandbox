import { CONTROLS } from './controls'
import { h, keyCaps, panel } from './dom'

/** Every key, grouped, straight from the controls table. */
export function controlsModal(): HTMLElement {
  const groups = CONTROLS.map((group) =>
    h('div', { class: 'sg-group' },
      h('h3', { text: group.title }),
      h('dl', {}, ...group.rows.flatMap((row) => [
        h('dt', {}, ...row.keys.flatMap((key, index) => [index > 0 ? h('i', { text: '/' }) : null, keyCaps(key)])),
        h('dd', { text: row.action }),
      ])),
    ),
  )
  const body = h('div', { class: 'sg-body sg-controls', attrs: { tabindex: '0' } }, ...groups)
  return panel('Controls', '// INPUT.MAP', body, true)
}
