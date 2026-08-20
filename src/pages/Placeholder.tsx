/**
 * 404 page — the last resident of the old placeholder file; /learn, /strategy
 * and /practice are real pages now.
 */
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell.tsx'
import c from '../components/controls.module.css'
import styles from './Placeholder.module.css'

export function NotFound() {
  return (
    <AppShell>
      <div className={styles.notFound}>
        <span className={styles.nfCode}>404</span>
        <h1 className={styles.title}>
          Off the <span className={styles.accent}>felt</span>
        </h1>
        <p className={styles.lede}>That page is not part of the table. The game is back at the front door.</p>
        <Link to="/" className={`${c.btn} ${c.btnTall} ${c.primary} ${styles.back}`}>
          Back to the table
        </Link>
      </div>
    </AppShell>
  )
}
