/**
 * The primary content container — serif title + mono sub, gradient panel
 * (source SectionCard pattern).
 */
import type { ReactNode } from 'react'
import styles from './SectionCard.module.css'

interface SectionCardProps {
  title?: ReactNode
  sub?: ReactNode
  headRight?: ReactNode
  children: ReactNode
  className?: string
}

export function SectionCard({ title, sub, headRight, children, className }: SectionCardProps) {
  return (
    <section className={`${styles.card} ${className ?? ''}`}>
      {title !== undefined || headRight !== undefined ? (
        <div className={styles.head}>
          <div>
            {title !== undefined ? <h2 className={styles.title}>{title}</h2> : null}
            {sub !== undefined ? <p className={styles.sub}>{sub}</p> : null}
          </div>
          {headRight !== undefined ? <div className={styles.headRight}>{headRight}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
