/**
 * /practice/:drillId — dispatch to the drill page; unknown ids get a small
 * on-brand redirect card back to the hub.
 */
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell.tsx'
import c from '../components/controls.module.css'
import styles from './Practice.module.css'
import PracticeClaim from './PracticeClaim.tsx'
import PracticeCounting from './PracticeCounting.tsx'
import PracticeDeduction from './PracticeDeduction.tsx'
import PracticeGame from './PracticeGame.tsx'
import PracticeLegality from './PracticeLegality.tsx'
import PracticeRecall from './PracticeRecall.tsx'

export default function PracticeDrill() {
  const { drillId } = useParams()
  switch (drillId) {
    case 'recall':
      return <PracticeRecall />
    case 'legality':
      return <PracticeLegality />
    case 'deduction':
      return <PracticeDeduction />
    case 'claim':
      return <PracticeClaim />
    case 'counting':
      return <PracticeCounting />
    case 'game':
      return <PracticeGame />
    default:
      return (
        <AppShell active="practice">
          <h1 className={styles.title}>
            No such <span className={styles.accent}>drill</span>
          </h1>
          <p className={styles.lede}>That exercise is not on the card. The six real ones are back at the hub.</p>
          <Link to="/practice" className={`${c.btn} ${c.btnTall} ${c.primary}`}>
            All drills
          </Link>
        </AppShell>
      )
  }
}
