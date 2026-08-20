/**
 * Shared page frame for Home and the placeholder pages: felt ground, grain,
 * serif wordmark with the italic brass accent, mono nav.
 */
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import styles from './AppShell.module.css'

export function Wordmark() {
  return (
    <span className={styles.wordmark}>
      Canadian <span className={styles.accent}>Fish</span>
    </span>
  )
}

interface AppShellProps {
  children: ReactNode
  /** Hide the nav links (used on the pages the links point to). */
  active?: 'learn' | 'strategy' | 'practice' | null
}

export function AppShell({ children, active = null }: AppShellProps) {
  return (
    <div className={styles.page}>
      <div className={styles.grain} aria-hidden="true" />
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          <Wordmark />
        </Link>
        <nav className={styles.nav} aria-label="Sections">
          <Link className={active === 'learn' ? styles.navActive : styles.navLink} to="/learn">
            Learn
          </Link>
          <Link className={active === 'strategy' ? styles.navActive : styles.navLink} to="/strategy">
            Strategy
          </Link>
          <Link className={active === 'practice' ? styles.navActive : styles.navLink} to="/practice">
            Practice
          </Link>
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <span>A 6-player Literature table — two teams, eight half-suits, no notes allowed.</span>
      </footer>
    </div>
  )
}
