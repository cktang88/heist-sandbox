import { h } from './dom'

/**
 * A small plain panel shown when errors keep repeating every frame, instead of a frozen picture. Deliberately
 * plain (inline styles, no menu machinery) so it still works when the thing that broke is the game's own UI.
 */
export function showCrashPanel(details: string, actions: { newHeist(): void }): () => void {
  const copy = h('button', { text: 'Copy error details', on: { click: () => {
    void navigator.clipboard?.writeText(details).then(() => { copy.textContent = 'Copied' }, () => { copy.textContent = 'Copy failed' })
  } } })
  const close = () => box.remove()
  const fresh = h('button', { text: 'New heist', on: { click: () => {
    close()
    actions.newHeist()
  } } })
  const box = h('div', { attrs: { role: 'alertdialog', 'aria-label': 'Something went wrong' } },
    h('p', { text: 'Something went wrong.' }), fresh, ' ', copy)
  Object.assign(box.style, {
    position: 'fixed', left: '50%', top: '40%', transform: 'translate(-50%, -50%)', zIndex: '50', padding: '16px 20px',
    background: '#111', color: '#eee', border: '1px solid #888', font: '16px system-ui, sans-serif', maxWidth: 'calc(100vw - 32px)',
  })
  document.body.append(box)
  fresh.focus()
  return close
}
