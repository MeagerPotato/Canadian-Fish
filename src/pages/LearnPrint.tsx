/**
 * /learn/rules-card — a one-page printable table reference distilled from
 * RULES.md. On screen it sits in the app shell with a Print button; @media
 * print strips the chrome down to a single clean black-on-white card.
 */
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell.tsx'
import c from '../components/controls.module.css'
import styles from './LearnPrint.module.css'

export default function LearnPrint() {
  useEffect(() => {
    document.body.classList.add('learn-print')
    return () => document.body.classList.remove('learn-print')
  }, [])

  return (
    <AppShell active="learn">
      <div className={styles.screenBar}>
        <div>
          <h1 className={styles.screenTitle}>
            Rules <span className={styles.accent}>card</span>
          </h1>
          <p className={styles.screenLede}>One page, table-side. Print it, fold it, argue less.</p>
        </div>
        <div className={styles.screenBtns}>
          <button type="button" className={`${c.btn} ${c.btnTall} ${c.primary}`} onClick={() => window.print()}>
            Print
          </button>
          <Link to="/learn" className={`${c.btn} ${c.btnTall} ${c.secondary}`}>
            Back to Learn
          </Link>
        </div>
      </div>

      <div className={styles.sheet}>
        <header className={styles.sheetHead}>
          <span className={styles.sheetTitle}>Canadian Fish (Literature)</span>
          <span className={styles.sheetSub}>6 players · 2 teams of 3 · 48 cards · 8 books</span>
        </header>

        <div className={styles.cols}>
          <section className={styles.block}>
            <h2 className={styles.blockTitle}>Setup</h2>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <th>Teams</th>
                  <td>Seats alternate: 0·2·4 = Team A, 1·3·5 = Team B</td>
                </tr>
                <tr>
                  <th>Deck</th>
                  <td>Standard 52 minus the four 8s → 48 cards</td>
                </tr>
                <tr>
                  <th>Books</th>
                  <td>Per suit: LOW = 2 3 4 5 6 7 · HIGH = 9 10 J Q K A</td>
                </tr>
                <tr>
                  <th>Deal</th>
                  <td>All 48 dealt, 8 per player; seat 0 asks first</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className={styles.block}>
            <h2 className={styles.blockTitle}>Asking — every gate must pass</h2>
            <ul className={styles.checks}>
              <li>Ask one specific card from one specific opponent — never a teammate, never yourself.</li>
              <li>You must hold at least one card of the asked half-suit.</li>
              <li>You may not ask for a card you hold.</li>
              <li>You must have cards; the target must have at least one card (of anything).</li>
            </ul>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <th>Hit</th>
                  <td>They hand the exact card over face up — you keep the turn and ask again</td>
                </tr>
                <tr>
                  <th>Miss</th>
                  <td>The turn passes to the player you asked</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className={styles.block}>
            <h2 className={styles.blockTitle}>Claims — on your own turn</h2>
            <p className={styles.note}>
              Name the book and the exact holder of every one of its six cards; holders must all be on your own team.
              You may claim a book while holding none of its cards.
            </p>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <th>All six right</th>
                  <td>Your team scores the book</td>
                </tr>
                <tr>
                  <th>Opponent holds any</th>
                  <td>The opposing team scores it, regardless of the rest</td>
                </tr>
                <tr>
                  <th>Right team, wrong seat</th>
                  <td>Book is void — removed from play, nobody scores</td>
                </tr>
              </tbody>
            </table>
            <p className={styles.note}>After any claim — scored, stolen or void — the claimant's turn continues.</p>
          </section>

          <section className={styles.block}>
            <h2 className={styles.blockTitle}>Out of cards &amp; endgame</h2>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <th>Emptied by a hit or another's claim</th>
                  <td>Drop out silently: can't ask, can't be asked; play continues around you</td>
                </tr>
                <tr>
                  <th>Emptied by your own claim</th>
                  <td>Pass the turn to any teammate who still has cards</td>
                </tr>
                <tr>
                  <th>Whole team out</th>
                  <td>
                    Play stops; the team with cards claims every remaining book — the turn-holder alone if they have
                    cards, else they designate one opponent with cards, who claims alone
                  </td>
                </tr>
              </tbody>
            </table>
            <p className={styles.note}>Endgame claims resolve normally — a misplaced card among teammates still voids.</p>
          </section>

          <section className={styles.block}>
            <h2 className={styles.blockTitle}>Ending &amp; information</h2>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <th>Game end</th>
                  <td>All 8 books resolved (scored or void)</td>
                </tr>
                <tr>
                  <th>Winner</th>
                  <td>More books wins; equal counts are a tie</td>
                </tr>
                <tr>
                  <th>Information</th>
                  <td>Every ask and answer is public; card counts are public; no written records — memory only</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className={styles.block}>
            <h2 className={styles.blockTitle}>House toggles — all off by default</h2>
            <p className={styles.toggles}>
              jokers (54-card, 9th book) · rank-quartet books · mandatory declare · announce last card · HIGH books ×2 ·
              bluff asks · declarer chooses next · claim on any turn · strict memory (last ask only)
            </p>
          </section>
        </div>

        <footer className={styles.sheetFoot}>canadian fish · the app shows the public log; nothing ever reveals a hidden card</footer>
      </div>
    </AppShell>
  )
}
