/**
 * Home — create a room, join by code, links to the learn/strategy/practice
 * pages, and a short rules blurb. Testids per PROTOCOL §7.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiCreateRoom, apiJoin, friendlyMessage } from '../api/client.ts'
import { loadName, saveName, saveToken } from '../api/storage.ts'
import { ErrorBanner } from '../components/Banners.tsx'
import { SectionCard } from '../components/SectionCard.tsx'
import { AppShell } from '../components/AppShell.tsx'
import c from '../components/controls.module.css'
import styles from './Home.module.css'

const CODE_ALPHABET = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g

export default function Home() {
  const navigate = useNavigate()
  const [createName, setCreateName] = useState(loadName())
  const [joinName, setJoinName] = useState(loadName())
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const create = async () => {
    if (busy) return
    setBusy('create')
    setBanner(null)
    const result = await apiCreateRoom(createName)
    setBusy(null)
    if (result.ok) {
      saveName(createName)
      saveToken(result.data.code, result.data.playerToken)
      navigate(`/r/${result.data.code}`)
    } else {
      setBanner(friendlyMessage(result.error))
    }
  }

  const join = async () => {
    if (busy || joinCode.length !== 6) return
    setBusy('join')
    setBanner(null)
    const result = await apiJoin(joinCode, joinName)
    setBusy(null)
    if (result.ok) {
      saveName(joinName)
      saveToken(joinCode, result.data.playerToken)
      navigate(`/r/${joinCode}`)
    } else {
      setBanner(friendlyMessage(result.error))
    }
  }

  return (
    <AppShell>
      <div className={styles.hero}>
        <h1 className={styles.title}>
          Canadian <span className={styles.titleAccent}>Fish</span>
        </h1>
        <p className={styles.pitch}>
          Six players, two teams, forty-eight cards — win half-suits by asking sharp questions and claiming when your
          team knows where every card sits.
        </p>
      </div>

      {banner ? <ErrorBanner message={banner} onDismiss={() => setBanner(null)} /> : null}

      <div className={styles.cards}>
        <SectionCard title="Open a table" sub="You take seat 0 and host">
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault()
              void create()
            }}
          >
            <div>
              <label className={c.fieldLabel} htmlFor="create-name">
                Your name
              </label>
              <input
                id="create-name"
                data-testid="create-name"
                className={c.input}
                value={createName}
                maxLength={20}
                placeholder="Player"
                autoComplete="nickname"
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            <button
              type="submit"
              data-testid="create-room"
              className={`${c.btn} ${c.btnTall} ${c.primary}`}
              disabled={busy !== null}
            >
              {busy === 'create' ? 'Opening…' : 'Create room'}
            </button>
            <p className={styles.formHint}>You get a 6-letter code to hand your table.</p>
          </form>
        </SectionCard>

        <SectionCard title="Join a table" sub="Six seats, first come first seated">
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault()
              void join()
            }}
          >
            <div>
              <label className={c.fieldLabel} htmlFor="join-code">
                Room code
              </label>
              <input
                id="join-code"
                data-testid="join-code"
                className={`${c.input} ${styles.codeInput}`}
                value={joinCode}
                maxLength={6}
                placeholder="ABC234"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(CODE_ALPHABET, '').slice(0, 6))}
              />
            </div>
            <div>
              <label className={c.fieldLabel} htmlFor="join-name">
                Your name
              </label>
              <input
                id="join-name"
                data-testid="join-name"
                className={c.input}
                value={joinName}
                maxLength={20}
                placeholder="Player"
                autoComplete="nickname"
                onChange={(e) => setJoinName(e.target.value)}
              />
            </div>
            <button
              type="submit"
              data-testid="join-room"
              className={`${c.btn} ${c.btnTall} ${c.secondary}`}
              disabled={busy !== null || joinCode.length !== 6}
            >
              {busy === 'join' ? 'Joining…' : 'Join room'}
            </button>
          </form>
        </SectionCard>
      </div>

      <SectionCard title="The game in four lines" sub="Literature, pinned rules">
        <ul className={styles.rules}>
          <li>Deck is 52 minus the 8s: eight half-suits of six — 2–7 low, 9–A high.</li>
          <li>On your turn, ask one opponent for one exact card of a half-suit you hold. Hit: you take it and ask again. Miss: their turn.</li>
          <li>Claim a half-suit by naming who on your team holds every card. All six right scores it — one wrong and it is gone.</li>
          <li>Eight half-suits resolve, most books wins. Counts are public; memory is the whole game.</li>
        </ul>
        <div className={styles.links}>
          <Link className={styles.pageLink} to="/learn">
            Learn the game
          </Link>
          <Link className={styles.pageLink} to="/strategy">
            Strategy notes
          </Link>
          <Link className={styles.pageLink} to="/practice">
            Practice vs bots
          </Link>
        </div>
      </SectionCard>
    </AppShell>
  )
}
