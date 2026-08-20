/**
 * Log humanization — public events → display lines ("Maya asked Sam for 9♥ — hit").
 * Newest first. Claim entries carry the full reveal detail (RULES.md §3: the
 * actual holders are public in every outcome).
 */
import type { PublicEvent, Seat } from '../../lib/engine/index.ts'
import { bookCards, seatTeam } from '../../lib/engine/index.ts'
import { bookLabel, cardLabel, teamLetter } from './format.ts'

export type LogKind = 'ask-hit' | 'ask-miss' | 'claim-won' | 'claim-lost' | 'claim-void' | 'info' | 'game-over'

export interface LogLineVM {
  key: string
  kind: LogKind
  text: string
  /** Claim reveals: one "9♥ — Maya" per card, in book order. */
  detail: string[] | null
}

type NameOf = (seat: Seat) => string

function humanizeEntry(entry: PublicEvent, index: number, name: NameOf): LogLineVM {
  const key = `${index}`
  switch (entry.type) {
    case 'game_started':
      return { key, kind: 'info', text: `Cards dealt — ${name(entry.startingSeat)} leads.`, detail: null }
    case 'ask': {
      const text = `${name(entry.asker)} asked ${name(entry.target)} for ${cardLabel(entry.card)} — ${
        entry.hit ? 'hit' : 'no'
      }.`
      return { key, kind: entry.hit ? 'ask-hit' : 'ask-miss', text, detail: null }
    }
    case 'claim': {
      const claimerTeam = seatTeam(entry.claimer)
      const label = bookLabel(entry.book)
      const detail = bookCards(entry.book).map((card) => {
        const holder = entry.actualHolders[card]
        return `${cardLabel(card)} — ${holder === undefined ? '?' : name(holder)}`
      })
      if (entry.outcome === 'void') {
        return {
          key,
          kind: 'claim-void',
          text: `${name(entry.claimer)} claimed ${label} — right team, wrong spots. Book void.`,
          detail,
        }
      }
      const winningTeam = entry.outcome === 'team0' ? 0 : 1
      if (winningTeam === claimerTeam) {
        return {
          key,
          kind: 'claim-won',
          text: `${name(entry.claimer)} claimed ${label} — correct. Team ${teamLetter(claimerTeam)} scores.`,
          detail,
        }
      }
      return {
        key,
        kind: 'claim-lost',
        text: `${name(entry.claimer)} claimed ${label} — the other side held a card. Team ${teamLetter(
          winningTeam,
        )} scores.`,
        detail,
      }
    }
    case 'pass':
      return { key, kind: 'info', text: `${name(entry.from)} passed the turn to ${name(entry.to)}.`, detail: null }
    case 'designate':
      return {
        key,
        kind: 'info',
        text: `${name(entry.from)} designated ${name(entry.to)} to claim the rest.`,
        detail: null,
      }
    case 'player_out':
      return { key, kind: 'info', text: `${name(entry.seat)} is out of cards.`, detail: null }
    case 'endgame':
      return {
        key,
        kind: 'info',
        text: `Endgame — Team ${teamLetter(entry.claimingTeam)} must claim the remaining half-suits.`,
        detail: null,
      }
    case 'game_over': {
      const [a, b] = entry.score
      const text =
        entry.winner === 'tie'
          ? `Game over — ${a}–${b}. A tie.`
          : `Game over — Team ${teamLetter(entry.winner)} wins ${a}–${b}.`
      return { key, kind: 'game-over', text, detail: null }
    }
  }
}

/** Humanize the whole log, newest entry first. */
export function humanizeLog(log: readonly PublicEvent[], name: NameOf): LogLineVM[] {
  return log.map((entry, i) => humanizeEntry(entry, i, name)).reverse()
}

/** The latest line only (for the sticky status strip). */
export function latestLine(log: readonly PublicEvent[], name: NameOf): LogLineVM | null {
  if (log.length === 0) return null
  return humanizeEntry(log[log.length - 1], log.length - 1, name)
}
