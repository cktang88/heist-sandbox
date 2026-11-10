/** A tiny element builder, so the menu code reads as structure rather than a pile of createElement calls. */
type Props = { class?: string; text?: string; attrs?: Record<string, string>; on?: Partial<Record<'click' | 'input' | 'change' | 'keydown', (event: Event) => void>> }
type Child = Node | string | null | false

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  if (props.class) element.className = props.class
  if (props.text !== undefined) element.textContent = props.text
  for (const [name, value] of Object.entries(props.attrs ?? {})) element.setAttribute(name, value)
  for (const [name, handler] of Object.entries(props.on ?? {})) element.addEventListener(name, handler)
  for (const child of children) if (child) element.append(child)
  return element
}

/**
 * A key cap. The same key twice ("9 9") means press it twice and shows two caps; "Hold G" shows the word
 * "hold" before the cap; anything else ("Left click") is one cap.
 */
export function keyCaps(key: string): HTMLElement {
  const [first, second] = key.split(' ')
  if (first === second) return h('span', { class: 'sg-keys' }, h('kbd', { text: first }), h('kbd', { text: second }))
  if (first === 'Hold' && second) return h('span', { class: 'sg-keys' }, h('small', { text: 'hold' }), h('kbd', { text: key.slice(5) }))
  return h('span', { class: 'sg-keys' }, h('kbd', { text: key }))
}

/** A panel's frame: the hazard strip, a title and a small system tag, then the body. */
export function panel(title: string, tag: string, body: HTMLElement, wide = false, extraKeys: Node | null = null): HTMLElement {
  const id = `sg-title-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`
  return h('section', { class: `sg-panel${wide ? ' sg-wide' : ''}`, attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id } },
    h('div', { class: 'sg-strip' }),
    h('header', { class: 'sg-head' }, h('h2', { text: title, attrs: { id } }), h('span', { class: 'sg-tag', text: tag })),
    body,
    h('footer', { class: 'sg-foot' }, h('span', {}, keyCaps('Esc'), ' back'), h('span', {}, extraKeys, keyCaps('Tab'), ' move  ', keyCaps('Enter'), ' choose')),
  )
}
