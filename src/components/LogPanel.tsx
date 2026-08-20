/**
 * The persistent public log (RULES.md row 18/§6) — distribution-table pattern:
 * grid rows on dark washes, hit rows carry a brass bar, claim rows carry the
 * verdict accent plus the full reveal. Newest first, scrolls within itself.
 */
import type { Seat } from '../../lib/engine/index.ts'
import type { PublicEvent } from '../../lib/engine/index.ts'
import { humanizeLog } from '../viewmodels/log.ts'
import { SectionCard } from './SectionCard.tsx'
import styles from './LogPanel.module.css'

interface LogPanelProps {
  log: readonly PublicEvent[]
  nameOf: (seat: Seat) => string
}

export function LogPanel({ log, nameOf }: LogPanelProps) {
  const lines = humanizeLog(log, nameOf)
  return (
    <SectionCard title="Table log" sub={`Public record · ${lines.length} ${lines.length === 1 ? 'entry' : 'entries'}`}>
      <div className={styles.scroll} data-testid="log">
        {lines.length === 0 ? (
          <p className={styles.empty}>Nothing yet — the first ask starts the record.</p>
        ) : (
          lines.map((line) => (
            <div key={line.key} data-testid="log-entry" className={`${styles.row} ${kindClass(line.kind)}`}>
              {line.kind === 'ask-hit' ? <span className={styles.bar} aria-hidden="true" /> : null}
              <span className={styles.text}>{line.text}</span>
              {line.detail ? <span className={styles.detail}>{line.detail.join(' · ')}</span> : null}
            </div>
          ))
        )}
      </div>
    </SectionCard>
  )
}

function kindClass(kind: string): string {
  switch (kind) {
    case 'ask-hit':
      return styles.hit
    case 'claim-won':
      return styles.won
    case 'claim-lost':
      return styles.lost
    case 'claim-void':
      return styles.voided
    case 'game-over':
      return styles.over
    default:
      return ''
  }
}
