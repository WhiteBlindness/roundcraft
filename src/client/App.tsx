import { useEffect, useState } from 'react'

import { createSession, loadToday, type TodayData } from './api'

type TodayState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly data: TodayData }
  | { readonly kind: 'error' }

function formatEditionDate(value: string): string {
  const [year, month, day] = value.split('-')

  return `${day}/${month}/${year} · UTC`
}

export function App() {
  const [today, setToday] = useState<TodayState>({ kind: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true

    loadToday()
      .then((data) => {
        if (isCurrent) setToday({ kind: 'ready', data })
      })
      .catch(() => {
        if (isCurrent) setToday({ kind: 'error' })
      })

    return () => {
      isCurrent = false
    }
  }, [reloadKey])

  async function handleStart(): Promise<void> {
    setIsCreatingSession(true)
    setStatusMessage(null)

    try {
      await createSession()
      setStatusMessage('Session secured. Attempt creation is the next step.')
    } catch {
      setStatusMessage('The session could not be secured. Please try again.')
    } finally {
      setIsCreatingSession(false)
    }
  }

  const availableEdition =
    today.kind === 'ready' && today.data.availability === 'available'
      ? today.data.edition
      : null

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Roundcraft home">
          Roundcraft
        </a>
        <nav aria-label="Primary navigation">
          <a aria-current="page" href="/today">
            Today
          </a>
          <a href="/cases">Cases</a>
          <a href="/progress">Progress</a>
        </nav>
      </header>

      <main>
        {today.kind === 'loading' ? (
          <section className="case-state" aria-live="polite">
            <p className="eyebrow">Today</p>
            <h1>Loading current case</h1>
          </section>
        ) : null}

        {today.kind === 'error' ? (
          <section className="case-state" aria-labelledby="today-error-title">
            <p className="eyebrow">Today</p>
            <h1 id="today-error-title">Case service unavailable</h1>
            <p className="case-intro">The current case could not be loaded.</p>
            <button
              className="secondary-action"
              type="button"
              onClick={() => {
                setToday({ kind: 'loading' })
                setReloadKey((current) => current + 1)
              }}
            >
              Try again
            </button>
          </section>
        ) : null}

        {today.kind === 'ready' &&
        today.data.availability === 'unavailable' ? (
          <section className="case-state" aria-labelledby="today-title">
            <p className="eyebrow">Today</p>
            <h1 id="today-title">No current case</h1>
            <p className="case-intro">
              The next verified edition is not available yet.
            </p>
            <p className="availability-label">Retry later</p>
          </section>
        ) : null}

        {availableEdition ? (
          <section className="case-cover" aria-labelledby="today-title">
            <div className="case-kicker">
              <span>Case {String(availableEdition.case_number).padStart(3, '0')}</span>
              <span>{availableEdition.estimated_minutes} min</span>
            </div>

            <div className="case-copy">
              <p className="eyebrow">Round reading · {availableEdition.focus}</p>
              <h1 id="today-title">Today’s tactical case</h1>
              <p className="case-intro">
                Study a legitimate round state, make one committed call, then
                adapt when the information changes.
              </p>
            </div>

            <dl className="case-metadata">
              <div>
                <dt>Format</dt>
                <dd>Main call + follow-up</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>Standard</dd>
              </div>
              <div>
                <dt>Edition</dt>
                <dd>{formatEditionDate(availableEdition.edition_date_utc)}</dd>
              </div>
            </dl>

            <div className="case-actions">
              <button
                type="button"
                disabled={isCreatingSession}
                onClick={() => void handleStart()}
              >
                {isCreatingSession ? 'Securing session' : 'Start case'}
                <span aria-hidden="true">→</span>
              </button>
              <p>{availableEdition.origin_label}</p>
            </div>
          </section>
        ) : null}

        {statusMessage ? (
          <p className="status-message" role="status">
            {statusMessage}
          </p>
        ) : null}
      </main>

      <footer>
        <p>Built for deliberate CS2 decisions, not reaction speed.</p>
        <p>Roundcraft · Foundation build</p>
      </footer>
    </div>
  )
}
