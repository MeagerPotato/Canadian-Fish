/**
 * Styled placeholder pages — /learn, /strategy, /practice — real, on-brand
 * content plus the "coming in a later phase tonight" marker, sharing the shell.
 */
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell.tsx'
import { SectionCard } from '../components/SectionCard.tsx'
import c from '../components/controls.module.css'
import styles from './Placeholder.module.css'

function ComingSoon({ what }: { what: string }) {
  return (
    <div className={styles.coming}>
      <span className={styles.comingWord}>{what}</span>
      <span className={styles.comingNote}>coming in a later phase tonight</span>
    </div>
  )
}

function BackHome() {
  return (
    <Link to="/" className={`${c.btn} ${c.btnTall} ${c.primary} ${styles.back}`}>
      Back to the table
    </Link>
  )
}

export function Learn() {
  return (
    <AppShell active="learn">
      <h1 className={styles.title}>
        Learn the <span className={styles.accent}>game</span>
      </h1>
      <p className={styles.lede}>
        Canadian Fish (also called Literature) is a partnership memory game. Nothing is written down — every question
        asked at the table is a clue for all six players.
      </p>
      <SectionCard title="The shape of it" sub="48 cards · 8 half-suits · 2 teams">
        <ul className={styles.list}>
          <li>Remove the four 8s from a standard deck. Each suit splits into a LOW half (2 3 4 5 6 7) and a HIGH half (9 10 J Q K A) — eight “books” of six cards.</li>
          <li>Seats alternate teams: 0, 2, 4 are Team A; 1, 3, 5 are Team B. Everyone starts with eight cards.</li>
          <li>On your turn you ask one specific opponent for one specific card. You must hold another card of that half-suit, and you may not ask for a card you hold.</li>
          <li>If they have it, they hand it over face up and you ask again. If not, the turn passes to them.</li>
        </ul>
      </SectionCard>
      <SectionCard title="Claims win the game" sub="All six placed, or nothing">
        <ul className={styles.list}>
          <li>On your turn you may claim a half-suit: name which teammate holds each of its six cards.</li>
          <li>All six right — your team scores the book. An opponent holds any of them — their team scores it. Right team, wrong seats — the book is void and nobody scores.</li>
          <li>After a claim your turn continues. When all eight books are resolved, the team with more books wins; equal is a tie.</li>
        </ul>
      </SectionCard>
      <ComingSoon what="Interactive tutorial" />
      <BackHome />
    </AppShell>
  )
}

export function Strategy() {
  return (
    <AppShell active="strategy">
      <h1 className={styles.title}>
        Strategy <span className={styles.accent}>notes</span>
      </h1>
      <p className={styles.lede}>
        Every ask is public. The best players spend questions to buy information for their team while giving as little
        as possible away.
      </p>
      <SectionCard title="Table craft" sub="What strong tables do">
        <ul className={styles.list}>
          <li>Your ask proves you hold a card of that half-suit and lack the card you named. The whole table hears it — ask what your team needs known, not just what you want.</li>
          <li>Track the misses. A refusal pins down what a player does not hold, and that narrows every later claim.</li>
          <li>Do not claim on a hunch: one wrong seat voids the book or gifts it. Wait until the asks have proven all six locations.</li>
          <li>Watch card counts. A teammate about to run out changes who can be asked and who should hold the turn late.</li>
        </ul>
      </SectionCard>
      <ComingSoon what="Worked examples and drills" />
      <BackHome />
    </AppShell>
  )
}

export function Practice() {
  return (
    <AppShell active="practice">
      <h1 className={styles.title}>
        Practice <span className={styles.accent}>room</span>
      </h1>
      <p className={styles.lede}>
        Practice rooms fill the empty seats with house bots so you can learn the rhythm of asks and claims without
        rounding up five friends.
      </p>
      <SectionCard title="What it will be" sub="Same table, house opponents">
        <ul className={styles.list}>
          <li>Open a room and bots take the remaining seats at your chosen difficulty.</li>
          <li>Bots see only what you see — public asks, counts, and the log. No peeking.</li>
          <li>Leave any time; a real room is one code away.</li>
        </ul>
      </SectionCard>
      <ComingSoon what="Bot opponents" />
      <BackHome />
    </AppShell>
  )
}

export function NotFound() {
  return (
    <AppShell>
      <div className={styles.notFound}>
        <span className={styles.nfCode}>404</span>
        <h1 className={styles.title}>
          Off the <span className={styles.accent}>felt</span>
        </h1>
        <p className={styles.lede}>That page is not part of the table. The game is back at the front door.</p>
        <BackHome />
      </div>
    </AppShell>
  )
}
