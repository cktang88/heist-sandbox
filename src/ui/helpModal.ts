import { h, keyCaps, panel } from './dom'
import { HELP_TABS, type HelpBlock } from './helpContent'

function block(content: HelpBlock): HTMLElement {
  switch (content.kind) {
    case 'text': return h('p', { text: content.text })
    case 'heading': return h('h3', { text: content.text })
    case 'example': return h('p', { class: 'sg-example' }, h('b', { text: 'e.g.' }), ` ${content.text}`)
    case 'list':
      return h('dl', { class: 'sg-terms' }, ...content.items.flatMap((item) => [
        h('dt', { text: item.term, class: item.tone ? `sg-tone-${item.tone}` : '' }),
        h('dd', { text: item.text }),
      ]))
  }
}

/** Short tabs instead of a wall of text. Left and right arrows switch tabs too. */
export function helpModal(): HTMLElement {
  const page = h('div', { class: 'sg-page', attrs: { role: 'tabpanel', tabindex: '0' } })
  const tabs = HELP_TABS.map((tab, index) => h('button', { class: 'sg-tab', text: tab.title, attrs: { type: 'button', role: 'tab' }, on: { click: () => show(index) } }))
  function show(index: number): void {
    tabs.forEach((tab, at) => tab.setAttribute('aria-selected', String(at === index)))
    page.replaceChildren(...HELP_TABS[index].blocks.map(block))
    page.scrollTop = 0
  }
  const bar = h('div', { class: 'sg-tabs', attrs: { role: 'tablist' } }, ...tabs)
  bar.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const at = tabs.indexOf(document.activeElement as HTMLButtonElement)
    const next = (at + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length
    tabs[next].focus()
    show(next)
  })
  tabs[0].dataset.autofocus = ''
  show(0)
  const arrows = h('span', {}, keyCaps('←'), keyCaps('→'), ' tabs  ')
  return panel('Help', '// FIELD.NOTES', h('div', { class: 'sg-body sg-help' }, bar, page), true, arrows)
}
