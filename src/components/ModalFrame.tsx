import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'

export function ModalFrame({ label, backdropClass, panelClass, onClose, children }: {
  label: string
  backdropClass: string
  panelClass: string
  onClose?: () => void
  children: ReactNode
}) {
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const initialFocus = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel
    initialFocus?.focus()
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose?.()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
    if (!focusable.length) {
      event.preventDefault()
      panelRef.current?.focus()
      return
    }
    const first = focusable[0]
    const last = focusable.at(-1)!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className={backdropClass}>
      <section ref={panelRef} className={panelClass} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={onKeyDown}>
        {children}
      </section>
    </div>
  )
}
