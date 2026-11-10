import { h } from './dom'

/**
 * The stack of open menus over the game. The top one has the keyboard; Esc closes it and hands focus back
 * to whatever was focused in the one below. While anything is open the game is paused.
 */
export type LayerStack = {
  push(name: string, panel: HTMLElement): void
  pop(): void
  clear(): void
  top(): string | null
  root: HTMLElement
}

type Layer = { name: string; element: HTMLElement; returnFocus: HTMLElement | null }

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex="0"]'

export function createLayerStack(onChange: (open: boolean) => void): LayerStack {
  const root = h('div', { class: 'sg-ui' })
  document.body.append(root)
  const layers: Layer[] = []

  function changed(): void {
    root.classList.toggle('sg-open', layers.length > 0)
    layers.forEach((layer, index) => layer.element.classList.toggle('sg-under', index < layers.length - 1))
    onChange(layers.length > 0)
  }

  function focusFirst(element: HTMLElement): void {
    const preferred = element.querySelector<HTMLElement>('[data-autofocus]') ?? element.querySelector<HTMLElement>(FOCUSABLE)
    preferred?.focus()
  }

  // Tab and Shift+Tab cycle inside the top menu instead of wandering off into the page behind it.
  root.addEventListener('keydown', (event) => {
    const top = layers[layers.length - 1]
    if (event.key !== 'Tab' || !top) return
    const items = [...top.element.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.offsetParent !== null)
    if (items.length === 0) return
    const at = items.indexOf(document.activeElement as HTMLElement)
    const next = event.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : (at + 1) % items.length
    items[next].focus()
    event.preventDefault()
  })

  return {
    root,
    push(name, panel) {
      const element = h('div', { class: 'sg-layer' }, panel)
      // A click on the dark area around the panel closes it, like Esc.
      element.addEventListener('mousedown', (event) => {
        if (event.target === element) this.pop()
      })
      layers.push({ name, element, returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null })
      root.append(element)
      changed()
      focusFirst(element)
    },
    pop() {
      const layer = layers.pop()
      if (!layer) return
      layer.element.remove()
      changed()
      if (layers.length > 0) layer.returnFocus?.focus()
      else (document.activeElement as HTMLElement | null)?.blur()
    },
    clear() {
      while (layers.length > 0) layers.pop()!.element.remove()
      ;(document.activeElement as HTMLElement | null)?.blur()
      changed()
    },
    top: () => layers[layers.length - 1]?.name ?? null,
  }
}
