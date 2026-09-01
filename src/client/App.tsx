import { useEffect, useState } from 'react'

import {
  createAttempt,
  createSession,
  loadToday,
  type AttemptData,
  type TodayData,
} from './api'

type TodayState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly data: TodayData }
  | { readonly kind: 'error' }

function formatEditionDate(value: string): string {
  const [year, month, day] = value.split('-')

  return `${day}/${month}/${year} · UTC`
}

const factLabels = {
  confirmed: 'Confirmed',
  last_seen: 'Last seen',
  inferred: 'Inferred',
  unknown: 'Unknown',
} as const

interface AttemptExperienceProps {
  readonly data: AttemptData
  readonly onExit: () => void
}

function AttemptExperience({ data, onExit }: AttemptExperienceProps) {
  const [stage, setStage] = useState<'brief' | 'evidence'>('brief')
  const [selectedEvidence, setSelectedEvidence] = useState<readonly string[]>([])
  const { brief } = data

  function toggleEvidence(evidenceId: string): void {
    setSelectedEvidence((current) => {
      if (current.includes(evidenceId)) {
        return current.filter((id) => id !== evidenceId)
      }

      return current.length < 2 ? [...current, evidenceId] : current
    })
  }

  return (
    <div className="app-shell attempt-shell">
      <header className="attempt-header">
        <button className="back-action" type="button" onClick={onExit}>
          Back to Today
        </button>
        <div className="attempt-context">
          <span>Official attempt</span>
          <strong>{brief.title}</strong>
        </div>
        <ol className="stage-track" aria-label="Case progress">
          <li aria-current={stage === 'brief' ? 'step' : undefined}>Brief</li>
          <li aria-current={stage === 'evidence' ? 'step' : undefined}>Evidence</li>
          <li>Decision</li>
          <li>Follow-up</li>
          <li>Debrief</li>
        </ol>
      </header>

      <main className="attempt-main">
        {stage === 'brief' ? (
          <section className="brief-screen" aria-labelledby="brief-title">
            <div className="brief-introduction">
              <h1 id="brief-title">Read the round</h1>
              <p>{brief.focus}</p>
            </div>

            <div className="brief-layout">
              <article className="round-facts">
                <header>
                  <h2>{brief.title}</h2>
                  <p>Separate what is known from what is merely suggested.</p>
                </header>
                <ul>
                  {brief.facts.map((fact) => (
                    <li key={fact.id}>
                      <span data-status={fact.status}>{factLabels[fact.status]}</span>
                      <p>{fact.text}</p>
                    </li>
                  ))}
                </ul>
              </article>

              <aside className="brief-ledger" aria-label="Round ledger">
                <h2>Decision set</h2>
                <dl>
                  <div>
                    <dt>Available calls</dt>
                    <dd>{brief.actions.length}</dd>
                  </div>
                  <div>
                    <dt>Evidence signals</dt>
                    <dd>{brief.evidence.length}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{brief.origin === 'synthetic' ? 'Synthetic' : 'Professional'}</dd>
                  </div>
                </dl>
                <p>
                  Your evidence choice is limited to two signals. The case does
                  not reveal how they will be scored.
                </p>
              </aside>
            </div>

            <div className="attempt-actions">
              <p>Read once. Commit deliberately.</p>
              <button type="button" onClick={() => setStage('evidence')}>
                Choose evidence
              </button>
            </div>
          </section>
        ) : (
          <section className="evidence-screen" aria-labelledby="evidence-title">
            <button
              className="back-action"
              type="button"
              onClick={() => setStage('brief')}
            >
              Back to briefing
            </button>
            <div className="evidence-heading">
              <h1 id="evidence-title">Choose two signals</h1>
              <p>
                Select the two facts that should carry the most weight in your
                decision.
              </p>
            </div>
            <fieldset className="evidence-options">
              <legend className="visually-hidden">Available evidence</legend>
              {brief.evidence.map((evidence, index) => {
                const checked = selectedEvidence.includes(evidence.id)
                const disabled = !checked && selectedEvidence.length === 2

                return (
                  <label key={evidence.id}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{evidence.label}</strong>
                    <input
                      type="checkbox"
                      aria-label={evidence.label}
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleEvidence(evidence.id)}
                    />
                  </label>
                )
              })}
            </fieldset>
            <div className="attempt-actions">
              <p>{selectedEvidence.length} of 2 selected</p>
              {selectedEvidence.length === 2 ? (
                <p className="selection-ready" role="status">
                  Selection ready for the decision step
                </p>
              ) : null}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export function App() {
  const [today, setToday] = useState<TodayState>({ kind: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [activeAttempt, setActiveAttempt] = useState<AttemptData | null>(null)

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
      if (!availableEdition) return

      const session = await createSession()
      const attempt = await createAttempt(
        availableEdition.edition_id,
        session.csrf_token,
      )
      setActiveAttempt(attempt)
    } catch {
      setStatusMessage('The case could not be started. Please try again.')
    } finally {
      setIsCreatingSession(false)
    }
  }

  const availableEdition =
    today.kind === 'ready' && today.data.availability === 'available'
      ? today.data.edition
      : null

  if (activeAttempt) {
    return (
      <AttemptExperience
        data={activeAttempt}
        onExit={() => setActiveAttempt(null)}
      />
    )
  }

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
                {isCreatingSession ? 'Starting case' : 'Start case'}
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
