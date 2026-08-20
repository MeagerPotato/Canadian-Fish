/**
 * Bottom sheet — mobile-first action surface. Dismissable variants get a
 * backdrop + Escape + close button; mandatory ones (pass/designate) render
 * without either. Keyboard: Escape closes, focus moves into the sheet on open
 * and returns to the opener on close.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Sheet.module.css'

interface SheetProps {
  title: string
  titleAccent?: string
  onClose?: () => void
  children: ReactNode
}

export function Sheet({ title, titleAccent, onClose, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => {
      opener?.focus?.()
    }
  }, [])

  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.wrap}>
      {onClose ? <button type="button" className={styles.backdrop} aria-label="Close" onClick={onClose} /> : null}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={onClose ? 'true' : undefined}
        aria-label={title}
        tabIndex={-1}
        className={styles.panel}
      >
        <div className={styles.head}>
          <h2 className={styles.title}>
            {title}
            {titleAccent ? <span className={styles.accent}> {titleAccent}</span> : null}
          </h2>
          {onClose ? (
            <button type="button" className={styles.close} onClick={onClose}>
              Close
            </button>
          ) : null}
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}
