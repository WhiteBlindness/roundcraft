import { useEffect, useRef, useState } from 'react'

import {
  createAttempt,
  createSession,
  commitMainAnswer,
  loadToday,
  type AttemptData,
  type FollowupCommitData,
  type MainCommitData,
  type TodayData,
} from './api'
import { FollowupExperience } from './FollowupExperience'

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

const idempotencyKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function loadMainIdempotencyKey(attemptId: string): string {
  try {
    const stored = localStorage.getItem(`roundcraft:main-key:${attemptId}`)
    if (stored && idempotencyKeyPattern.test(stored)) return stored
  } catch {
    // Storage is an optional draft aid; the server remains authoritative.
  }

  return crypto.randomUUID()
}

interface AttemptExperienceProps {
  readonly data: AttemptData
  readonly csrfToken: string
  readonly onExit: () => void
}

type AttemptStage =
  | 'brief'
  | 'evidence'
  | 'call'
  | 'review'
  | 'followup'
  | 'debrief'

function AttemptExperience({ data, csrfToken, onExit }: AttemptExperienceProps) {
  const resumedCommit: MainCommitData | null =
    'main_answer' in data
      ? {
          attempt: {
            attempt_id: data.attempt.attempt_id,
            state: 'main_locked',
            sequence: 1,
            main_committed_at: data.attempt.main_committed_at,
          },
          main_answer: data.main_answer,
          followup: data.followup,
        }
      : null
  const resumedResult: FollowupCommitData | null =
    'result' in data
      ? {
          attempt: {
            attempt_id: data.attempt.attempt_id,
            state: 'decision_complete',
            sequence: 2,
            followup_committed_at: data.attempt.followup_committed_at,
          },
          main_answer: data.main_answer,
          followup_answer: data.followup_answer,
          result: data.result,
          reveal: data.reveal,
        }
      : null
  const [stage, setStage] = useState<AttemptStage>(
    resumedResult ? 'debrief' : resumedCommit ? 'followup' : 'brief',
  )
  const [selectedEvidence, setSelectedEvidence] = useState<readonly string[]>(
    resumedCommit?.main_answer.evidence_ids ?? [],
  )
  const [selectedAction, setSelectedAction] = useState(
    resumedCommit?.main_answer.action_id ?? '',
  )
  const [selectedQualifier, setSelectedQualifier] = useState(
    resumedCommit?.main_answer.qualifier_id ?? '',
  )
  const [selectedConfidence, setSelectedConfidence] = useState(
    resumedCommit?.main_answer.confidence_id ?? '',
  )
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionStarted, setSubmissionStarted] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [mainCommit, setMainCommit] = useState<MainCommitData | null>(
    resumedCommit,
  )
  const idempotencyKey = useRef(
    loadMainIdempotencyKey(data.attempt.attempt_id),
  )
  const { brief } = data

  useEffect(() => {
    try {
      localStorage.setItem(
        `roundcraft:main-key:${data.attempt.attempt_id}`,
        idempotencyKey.current,
      )
    } catch {
      // A blocked local draft must not block the official attempt.
    }
  }, [data.attempt.attempt_id])

  function toggleEvidence(evidenceId: string): void {
    setSelectedEvidence((current) => {
      if (current.includes(evidenceId)) {
        setSelectionMessage(null)
        return current.filter((id) => id !== evidenceId)
      }

      if (current.length === 2) {
        setSelectionMessage('Remove one signal before choosing another.')
        return current
      }

      setSelectionMessage(null)
      return [...current, evidenceId]
    })
  }

  function optionLabel(
    options: readonly { readonly id: string; readonly label: string }[],
    id: string,
  ): string {
    return options.find((option) => option.id === id)?.label ?? ''
  }

  function chooseAction(actionId: string): void {
    setSelectedAction(actionId)
    setSelectedQualifier('')
  }

  async function lockMainCall(): Promise<void> {
    if (
      selectedEvidence.length !== 2 ||
      !selectedAction ||
      !selectedQualifier ||
      !selectedConfidence
    ) {
      return
    }

    setIsSubmitting(true)
    setSubmissionStarted(true)
    setSubmissionError(null)

    try {
      const committed = await commitMainAnswer(
        data.attempt.attempt_id,
        csrfToken,
        idempotencyKey.current,
        {
          case_revision: brief.caseRevision,
          action_id: selectedAction,
          qualifier_id: selectedQualifier,
          evidence_ids: selectedEvidence as [string, string],
          confidence_id: selectedConfidence,
        },
      )
      setMainCommit(committed)
      try {
        localStorage.removeItem(`roundcraft:main-key:${data.attempt.attempt_id}`)
      } catch {
        // The accepted server state does not depend on local storage cleanup.
      }
      setStage('followup')
    } catch {
      setSubmissionError(
        'The acknowledgement was not received. Retry the same submission.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeAction = brief.actions.find(({ id }) => id === selectedAction)
  const validQualifiers = activeAction
    ? brief.qualifiers.filter(({ id }) => activeAction.qualifierIds.includes(id))
    : []
  const canReview = Boolean(
    selectedEvidence.length === 2 &&
      selectedAction &&
      selectedQualifier &&
      selectedConfidence,
  )
  const decisionStage = stage === 'call' || stage === 'review'

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
          <li aria-current={decisionStage ? 'step' : undefined}>Decision</li>
          <li aria-current={stage === 'followup' ? 'step' : undefined}>Follow-up</li>
          <li aria-current={stage === 'debrief' ? 'step' : undefined}>Debrief</li>
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
        ) : null}

        {stage === 'evidence' ? (
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

                return (
                  <label key={evidence.id}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{evidence.label}</strong>
                    <input
                      type="checkbox"
                      aria-label={evidence.label}
                      checked={checked}
                      onChange={() => toggleEvidence(evidence.id)}
                    />
                  </label>
                )
              })}
            </fieldset>
            <div className="attempt-actions">
              <p role="status">
                {selectionMessage ?? `${selectedEvidence.length} of 2 selected`}
              </p>
              <button
                type="button"
                disabled={selectedEvidence.length !== 2}
                onClick={() => setStage('call')}
              >
                Continue to call
              </button>
            </div>
          </section>
        ) : null}

        {stage === 'call' ? (
          <section className="decision-screen" aria-labelledby="call-title">
            <button
              className="back-action"
              type="button"
              onClick={() => setStage('evidence')}
            >
              Back to evidence
            </button>
            <div className="decision-heading">
              <h1 id="call-title">Make the call</h1>
              <p>Choose one operational line and state how you would execute it.</p>
            </div>

            <section className="selected-summary" aria-labelledby="selected-evidence-title">
              <h2 id="selected-evidence-title">Signals carried forward</h2>
              <ul>
                {selectedEvidence.map((id) => (
                  <li key={id}>{optionLabel(brief.evidence, id)}</li>
                ))}
              </ul>
            </section>

            <div className="decision-form">
              <fieldset className="choice-group">
                <legend>Your action</legend>
                {brief.actions.map((action) => (
                  <label key={action.id}>
                    <input
                      type="radio"
                      name="action"
                      value={action.id}
                      checked={selectedAction === action.id}
                      onChange={() => chooseAction(action.id)}
                    />
                    <span>{action.label}</span>
                  </label>
                ))}
              </fieldset>

              <fieldset className="choice-group" disabled={!activeAction}>
                <legend>How you execute it</legend>
                {validQualifiers.length ? (
                  validQualifiers.map((qualifier) => (
                    <label key={qualifier.id}>
                      <input
                        type="radio"
                        name="qualifier"
                        value={qualifier.id}
                        checked={selectedQualifier === qualifier.id}
                        onChange={() => setSelectedQualifier(qualifier.id)}
                      />
                      <span>{qualifier.label}</span>
                    </label>
                  ))
                ) : (
                  <p>Select an action to reveal its valid execution lines.</p>
                )}
              </fieldset>
            </div>

            <fieldset className="confidence-group">
              <legend>
                Confidence <span>Unscored reflection</span>
              </legend>
              <div>
                {brief.confidence.map((confidence) => (
                  <label key={confidence.id}>
                    <input
                      type="radio"
                      name="confidence"
                      value={confidence.id}
                      checked={selectedConfidence === confidence.id}
                      onChange={() => setSelectedConfidence(confidence.id)}
                    />
                    <span>{confidence.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="attempt-actions">
              <p>Your confidence does not affect the score.</p>
              <button
                type="button"
                disabled={!canReview}
                onClick={() => setStage('review')}
              >
                Review call
              </button>
            </div>
          </section>
        ) : null}

        {stage === 'review' ? (
          <section className="review-screen" aria-labelledby="review-title">
            <div className="decision-heading">
              <h1 id="review-title">Review your line</h1>
              <p>Check the official line before it becomes permanent.</p>
            </div>

            <dl className="review-ledger">
              <div>
                <dt>Action</dt>
                <dd>{optionLabel(brief.actions, selectedAction)}</dd>
              </div>
              <div>
                <dt>Execution</dt>
                <dd>{optionLabel(brief.qualifiers, selectedQualifier)}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>
                  {selectedEvidence
                    .map((id) => optionLabel(brief.evidence, id))
                    .join(' · ')}
                </dd>
              </div>
              <div>
                <dt>Confidence · unscored</dt>
                <dd>{optionLabel(brief.confidence, selectedConfidence)}</dd>
              </div>
            </dl>

            <p className="permanence-notice">
              You cannot change this official line after it is locked.
            </p>
            {submissionError ? (
              <p className="submission-error" role="alert">{submissionError}</p>
            ) : null}
            <div className="review-actions">
              <button
                className="back-action"
                type="button"
                disabled={submissionStarted}
                onClick={() => setStage('call')}
              >
                Edit call
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void lockMainCall()}
              >
                {isSubmitting
                  ? 'Submitting…'
                  : submissionStarted
                    ? 'Retry main submission'
                    : 'Lock main call'}
              </button>
            </div>
          </section>
        ) : null}

        {(stage === 'followup' || stage === 'debrief') && mainCommit ? (
          <FollowupExperience
            attemptId={data.attempt.attempt_id}
            csrfToken={csrfToken}
            brief={brief}
            mainCommit={mainCommit}
            initialResult={resumedResult}
            onStageChange={setStage}
          />
        ) : null}
      </main>
    </div>
  )
}

export function App() {
  const [today, setToday] = useState<TodayState>({ kind: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [activeAttempt, setActiveAttempt] = useState<{
    readonly data: AttemptData
    readonly csrfToken: string
  } | null>(null)

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
      setActiveAttempt({ data: attempt, csrfToken: session.csrf_token })
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
        data={activeAttempt.data}
        csrfToken={activeAttempt.csrfToken}
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
