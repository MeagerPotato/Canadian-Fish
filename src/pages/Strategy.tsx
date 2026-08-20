/**
 * /strategy — community strategy & conventions, fully attributed. Content
 * lives in src/learn/strategy-content.ts; every external claim carries its
 * sources inline and single-source items are flagged.
 */
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell.tsx'
import { PlayingCard } from '../components/PlayingCard.tsx'
import { SectionCard } from '../components/SectionCard.tsx'
import c from '../components/controls.module.css'
import {
  ACCESS_DATE,
  BOTS_NOTES,
  EXAMPLES,
  SECTIONS,
  SOURCES,
  VARIANTS,
} from '../learn/strategy-content.ts'
import type { SourceId } from '../learn/strategy-content.ts'
import type { Card } from '../../lib/engine/index.ts'
import styles from './Strategy.module.css'

const SHORT: Record<SourceId, string> = Object.fromEntries(SOURCES.map((s) => [s.id, s.short])) as Record<
  SourceId,
  string
>

function Attribution({ sources }: { sources: SourceId[] }) {
  return (
    <span className={styles.attr}>
      <span className={styles.attrNames}>{sources.map((id) => SHORT[id]).join(' · ')}</span>
      {sources.length === 1 ? <span className={styles.singleFlag}>single source</span> : null}
    </span>
  )
}

function ItemList({
  items,
}: {
  items: { lead: string; text: string; sources: SourceId[]; inApp?: string }[]
}) {
  return (
    <ul className={styles.items}>
      {items.map((item) => (
        <li key={item.lead} className={styles.item}>
          <p className={styles.itemText}>
            <b>{item.lead}</b> {item.text}
          </p>
          <Attribution sources={item.sources} />
          {item.inApp !== undefined ? <p className={styles.inApp}>On this table: {item.inApp}</p> : null}
        </li>
      ))}
    </ul>
  )
}

export default function Strategy() {
  return (
    <AppShell active="strategy">
      <h1 className={styles.title}>
        Strategy <span className={styles.accent}>notes</span>
      </h1>
      <p className={styles.lede}>
        What the people who wrote this game down actually advise — collected from the sources listed at the bottom
        (all accessed {ACCESS_DATE}), with each idea attributed to whoever said it.
      </p>

      <SectionCard title="Two traditions, one game" sub="AN HONEST DISCLAIMER">
        <p className={styles.prose}>
          The written record splits into two lineages. The <b>pagat Literature tradition</b> (South India to Toronto)
          plays the turn-based game our table implements and tolerates — even documents — signalling conventions. The{' '}
          <b>US student Fish tradition</b> (54 cards with jokers, out-of-turn declares, olympiad-camp culture) bans
          prearranged conventions outright. They disagree about conventions, claim timing, even the deck. Nothing below
          pretends to be a single consensus: every idea names its tradition, and items resting on one source are
          flagged.
        </p>
      </SectionCard>

      {SECTIONS.map((section) => (
        <SectionCard key={section.id} title={section.title} sub={section.sub}>
          {section.intro !== undefined ? <p className={styles.prose}>{section.intro}</p> : null}
          <ItemList items={section.items} />
        </SectionCard>
      ))}

      <SectionCard title="Worked examples" sub="ADAPTED FROM THE SOURCES">
        <div className={styles.examples}>
          {EXAMPLES.map((ex) => (
            <article key={ex.id} className={styles.example}>
              <header className={styles.exHead}>
                <h3 className={styles.exTitle}>{ex.title}</h3>
                <span className={styles.exFrom}>{ex.from}</span>
              </header>
              {ex.cards !== undefined ? (
                <div className={styles.exCards}>
                  {ex.cards.map((card) => (
                    <PlayingCard key={card} card={card as Card} size="sm" />
                  ))}
                  {ex.focus !== undefined ? (
                    <>
                      <span className={styles.exFocusArrow} aria-hidden="true">
                        →
                      </span>
                      <span className={styles.exFocus}>
                        <PlayingCard card={ex.focus as Card} size="sm" />
                      </span>
                    </>
                  ) : null}
                </div>
              ) : null}
              {ex.paragraphs.map((p) => (
                <p key={p.slice(0, 24)} className={styles.exBody}>
                  {p}
                </p>
              ))}
              <Attribution sources={ex.sources} />
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Variants around the world" sub="ATTRIBUTED · WITH OUR TOGGLES">
        <ItemList items={VARIANTS} />
        <p className={styles.inApp}>
          Every toggle above is an engine flag from RULES.md §5, all off by default; the shipped game is the 48-card,
          6-player, turn-based-claim baseline.
        </p>
      </SectionCard>

      <div className={styles.botsBox}>
        <h2 className={styles.botsTitle}>How the bots here play</h2>
        <p className={styles.botsSub}>OUR OWN KITCHEN — NO CITATIONS NEEDED</p>
        <ul className={styles.botsList}>
          {BOTS_NOTES.map((note) => (
            <li key={note.slice(0, 24)}>{note}</li>
          ))}
        </ul>
        <Link to="/practice" className={`${c.btn} ${c.btnTall} ${c.primary} ${styles.botsCta}`}>
          Try them in the practice room
        </Link>
      </div>

      <SectionCard title="Sources" sub={`ALL ACCESSED ${ACCESS_DATE}`}>
        <ul className={styles.sources}>
          {SOURCES.map((s) => (
            <li key={s.id} className={styles.source}>
              <span className={styles.sourceShort}>{s.short}</span>
              <span className={styles.sourceFull}>
                {s.full}
                {s.note !== undefined ? <em className={styles.sourceNote}> — {s.note}</em> : null}
                <br />
                <a className={styles.sourceUrl} href={s.url} target="_blank" rel="noreferrer">
                  {s.url}
                </a>
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.methodNote}>
          Method note: one further site surveyed in research (CardRules+) was excluded from this page entirely for low
          provenance. Ideas backed by one source only are marked <span className={styles.singleFlagInline}>single source</span>{' '}
          wherever they appear above.
        </p>
      </SectionCard>

      <div className={styles.footCtas}>
        <Link to="/learn" className={`${c.btn} ${c.btnTall} ${c.secondary}`}>
          Learn the game
        </Link>
        <Link to="/" className={`${c.btn} ${c.btnTall} ${c.secondary}`}>
          Back to the table
        </Link>
      </div>
    </AppShell>
  )
}
