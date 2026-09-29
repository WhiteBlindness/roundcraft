import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'

import {
  createAttempt,
  createSession,
  commitMainAnswer,
  loadToday,
  recordEvent,
  type AttemptData,
  type FollowupCommitData,
  type MainCommitData,
  type TodayData,
} from './api'
import { CasesPage } from './CasesPage'
import {
  loadDraftState,
  saveDraft as idbSaveDraft,
  clearDraft as idbClearDraft,
  saveIdempotencyKey as idbSaveKey,
  clearIdempotencyKey as idbClearKey,
  type LoadedDraftState,
} from './draft-store'
import { FollowupExperience } from './FollowupExperience'
import './attempt-aids.css'
import { isActivatableTarget, isInsideDialog, isTextEntryTarget } from './keyboard'
import {
  PrivacyPolicyPage,
  TermsPage,
  CookiesPolicyPage,
} from './LegalPages'
import { ProgressPage } from './ProgressPage'
import { SettingsPage } from './SettingsPage'

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    function goOnline() { setOnline(true) }
    function goOffline() { setOnline(false) }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}

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

const factMeanings: readonly { readonly status: keyof typeof factLabels; readonly meaning: string }[] = [
  { status: 'confirmed', meaning: 'True at the current moment of the round.' },
  { status: 'last_seen', meaning: 'Observed earlier and not reconfirmed. It may be stale.' },
  { status: 'inferred', meaning: 'A supported reading of the evidence, not an observation.' },
  { status: 'unknown', meaning: 'Deliberately unavailable. Plan around the gap.' },
]

function FactLegend() {
  return (
    <details className="fact-legend">
      <summary>What the fact labels mean</summary>
      <dl>
        {factMeanings.map(({ status, meaning }) => (
          <div key={status}>
            <dt><span data-status={status}>{factLabels[status]}</span></dt>
            <dd>{meaning}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}


interface AttemptExperienceProps {
  readonly data: AttemptData
  readonly csrfToken: string
  readonly caseNumber: number
  readonly editionDate: string
  readonly onExit: () => void
}

type AttemptStage =
  | 'brief'
  | 'evidence'
  | 'call'
  | 'review'
  | 'followup'
  | 'debrief'

function AttemptExperience(props: AttemptExperienceProps) {
  const { data } = props
  const hasServerState = 'main_answer' in data
  const [draftState, setDraftState] = useState<LoadedDraftState | null>(
    hasServerState ? { draft: null, idempotencyKey: crypto.randomUUID() } : null,
  )

  useEffect(() => {
    if (hasServerState) return
    let cancelled = false
    loadDraftState(data.attempt.attempt_id).then((state) => {
      if (!cancelled) setDraftState(state)
    })
    return () => { cancelled = true }
  }, [hasServerState, data.attempt.attempt_id])

  if (!draftState) {
    return (
      <div className="app-shell attempt-shell">
        <header className="attempt-header">
          <span className="back-action">&nbsp;</span>
          <div className="attempt-context">
            <span>Official attempt</span>
            <strong>Restoring progress…</strong>
          </div>
        </header>
        <main className="attempt-main">
          <section className="brief-screen" aria-busy="true">
            <p className="eyebrow">Loading your saved selections…</p>
          </section>
        </main>
      </div>
    )
  }

  return <AttemptExperienceReady {...props} loadedDraft={draftState} />
}

interface AttemptExperienceReadyProps extends AttemptExperienceProps {
  readonly loadedDraft: LoadedDraftState
}

function AttemptExperienceReady({ data, csrfToken, caseNumber, editionDate, onExit, loadedDraft }: AttemptExperienceReadyProps) {
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
  const savedDraft = resumedCommit ? null : loadedDraft.draft
  const hasDraft = savedDraft !== null && (
    savedDraft.evidence_ids.length > 0 || savedDraft.action_id !== ''
  )

  function initialStage(): AttemptStage {
    if (resumedResult) return 'debrief'
    if (resumedCommit) return 'followup'
    if (savedDraft?.action_id) return 'call'
    if (savedDraft && savedDraft.evidence_ids.length > 0) return 'evidence'
    return 'brief'
  }

  const [stage, setStageRaw] = useState<AttemptStage>(initialStage)
  const [draftNotice, setDraftNotice] = useState(hasDraft)

  useEffect(() => {
    if (stage === 'debrief') return

    function warn(e: BeforeUnloadEvent) { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [stage])

  function setStage(next: AttemptStage): void {
    setStageRaw(next)
    setDraftNotice(false)
    window.scrollTo(0, 0)
  }
  const [selectedEvidence, setSelectedEvidence] = useState<readonly string[]>(
    resumedCommit?.main_answer.evidence_ids ?? savedDraft?.evidence_ids ?? [],
  )
  const [selectedAction, setSelectedAction] = useState(
    resumedCommit?.main_answer.action_id ?? savedDraft?.action_id ?? '',
  )
  const [selectedQualifier, setSelectedQualifier] = useState(
    resumedCommit?.main_answer.qualifier_id ?? savedDraft?.qualifier_id ?? '',
  )
  const [selectedConfidence, setSelectedConfidence] = useState(
    resumedCommit?.main_answer.confidence_id ?? savedDraft?.confidence_id ?? '',
  )
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionStarted, setSubmissionStarted] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [mainCommit, setMainCommit] = useState<MainCommitData | null>(
    resumedCommit,
  )
  const [showShortcuts, setShowShortcuts] = useState(false)
  const shortcutsDialog = useRef<HTMLDialogElement>(null)
  const idempotencyKey = useRef(loadedDraft.idempotencyKey)
  const briefHeading = useRef<HTMLHeadingElement>(null)
  const evidenceHeading = useRef<HTMLHeadingElement>(null)
  const callHeading = useRef<HTMLHeadingElement>(null)
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const { brief } = data

  useEffect(() => {
    void idbSaveKey(data.attempt.attempt_id, idempotencyKey.current)
  }, [data.attempt.attempt_id])

  useEffect(() => {
    if (mainCommit) return
    void idbSaveDraft(data.attempt.attempt_id, {
      evidence_ids: selectedEvidence,
      action_id: selectedAction,
      qualifier_id: selectedQualifier,
      confidence_id: selectedConfidence,
    })
  }, [data.attempt.attempt_id, mainCommit, selectedEvidence, selectedAction, selectedQualifier, selectedConfidence])

  useEffect(() => {
    if (stage === 'brief') briefHeading.current?.focus()
    else if (stage === 'evidence') evidenceHeading.current?.focus()
    else if (stage === 'call') callHeading.current?.focus()
    else if (stage === 'review') reviewHeading.current?.focus()
  }, [stage])

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
      void idbClearDraft(data.attempt.attempt_id)
      void idbClearKey(data.attempt.attempt_id)
      setStage('followup')
      void recordEvent('main_committed', { edition_id: data.attempt.edition_id, mode: 'official' }, csrfToken)
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

  const onAttemptKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return
    if (isTextEntryTarget(e.target)) return

    if (e.key === '?') {
      e.preventDefault()
      if (showShortcuts) shortcutsDialog.current?.close()
      else setShowShortcuts(true)
      return
    }

    if (showShortcuts || isInsideDialog(e.target)) return
    if (stage === 'followup' || stage === 'debrief') return

    if (e.key === 'Enter') {
      if (isActivatableTarget(e.target)) return
      e.preventDefault()
      if (stage === 'brief') setStage('evidence')
      else if (stage === 'evidence' && selectedEvidence.length === 2) setStage('call')
      else if (stage === 'call' && canReview) setStage('review')
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      if (stage === 'evidence') setStage('brief')
      else if (stage === 'call') setStage('evidence')
      else if (stage === 'review' && !submissionStarted) setStage('call')
      return
    }

    if (stage === 'evidence') {
      const num = parseInt(e.key, 10)
      const item = num >= 1 ? brief.evidence[num - 1] : undefined
      if (item) {
        e.preventDefault()
        toggleEvidence(item.id)
      }
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', onAttemptKeyDown)
    return () => window.removeEventListener('keydown', onAttemptKeyDown)
  }, [])

  const decisionStage = stage === 'call' || stage === 'review'

  const stageOrder: readonly AttemptStage[] = ['brief', 'evidence', 'call', 'followup', 'debrief']
  const currentIndex = stageOrder.indexOf(stage === 'review' ? 'call' : stage)

  function stageStatus(index: number): 'completed' | 'current' | undefined {
    if (index < currentIndex) return 'completed'
    if (index === currentIndex) return 'current'
    return undefined
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
          <li aria-current={stage === 'brief' ? 'step' : undefined} data-status={stageStatus(0)}>Brief</li>
          <li aria-current={stage === 'evidence' ? 'step' : undefined} data-status={stageStatus(1)}>Evidence</li>
          <li aria-current={decisionStage ? 'step' : undefined} data-status={stageStatus(2)}>Decision</li>
          <li aria-current={stage === 'followup' ? 'step' : undefined} data-status={stageStatus(3)}>Follow-up</li>
          <li aria-current={stage === 'debrief' ? 'step' : undefined} data-status={stageStatus(4)}>Debrief</li>
        </ol>
        <button
          className="shortcuts-hint"
          type="button"
          aria-label="Keyboard shortcuts"
          onClick={() => setShowShortcuts(true)}
        >
          <kbd>?</kbd> Shortcuts
        </button>
      </header>

      {draftNotice ? (
        <p className="draft-notice" role="status">
          Your previous selections were restored.
          <button type="button" onClick={() => setDraftNotice(false)}>Dismiss</button>
        </p>
      ) : null}

      <main className="attempt-main">
        {stage === 'brief' ? (
          <section className="brief-screen" aria-labelledby="brief-title">
            <div className="brief-introduction">
              <h1 id="brief-title" ref={briefHeading} tabIndex={-1}>Read the round</h1>
              <p>{brief.focus}</p>
            </div>

            <div className="brief-layout">
              <article className="round-facts">
                <header>
                  <h2>{brief.title}</h2>
                  <p>Separate what is known from what is merely suggested.</p>
                  <FactLegend />
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
              <h1 id="evidence-title" ref={evidenceHeading} tabIndex={-1}>Choose two signals</h1>
              <p>
                Select the two facts that should carry the most weight in your
                decision.
              </p>
            </div>
            <details className="facts-recap">
              <summary>Round facts ({brief.facts.length})</summary>
              <ul>
                {brief.facts.map((fact) => (
                  <li key={fact.id}>
                    <span data-status={fact.status}>{factLabels[fact.status]}</span>
                    <p>{fact.text}</p>
                  </li>
                ))}
              </ul>
            </details>
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
              <p
                className={!selectionMessage && selectedEvidence.length === 2 ? 'selection-ready' : undefined}
                role="status"
              >
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
              <h1 id="call-title" ref={callHeading} tabIndex={-1}>Make the call</h1>
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
              <fieldset className="choice-group" aria-required="true">
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

              <fieldset className="choice-group" aria-required="true" disabled={!activeAction}>
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
              <h1 id="review-title" ref={reviewHeading} tabIndex={-1}>Review your line</h1>
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
            caseNumber={caseNumber}
            editionDate={editionDate}
            brief={brief}
            mainCommit={mainCommit}
            initialResult={resumedResult}
            initialReviewCompleted={
              data.attempt.state === 'debrief_complete'
            }
            onExit={onExit}
            onStageChange={setStage}
          />
        ) : null}
      </main>

      {showShortcuts ? (
        <ShortcutsDialog
          dialogRef={shortcutsDialog}
          stage={stage}
          hasNumberedResponses={mainCommit?.followup.type === 'new_information'}
          onClose={() => setShowShortcuts(false)}
        />
      ) : null}
    </div>
  )
}

function ShortcutsDialog({
  dialogRef,
  stage,
  hasNumberedResponses,
  onClose,
}: {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>
  readonly stage: AttemptStage
  readonly hasNumberedResponses: boolean
  readonly onClose: () => void
}) {
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    // No cleanup: closing here would fire `close` during StrictMode's
    // simulated unmount; removing the element from the DOM closes it anyway.
    if (!dialog.open) dialog.showModal()
  }, [dialogRef])

  return (
    <dialog
      ref={dialogRef}
      className="shortcuts-dialog"
      aria-labelledby="shortcuts-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close()
      }}
    >
      <div className="shortcuts-panel">
        <div className="shortcuts-header">
          <h2 id="shortcuts-title">Keyboard shortcuts</h2>
          <button
            type="button"
            aria-label="Close keyboard shortcuts"
            onClick={() => dialogRef.current?.close()}
          >
            &times;
          </button>
        </div>
        <dl className="shortcuts-list">
          <div>
            <dt><kbd>Enter</kbd></dt>
            <dd>Continue to the next step. Enter never locks a decision.</dd>
          </div>
          {stage !== 'debrief' ? (
            <div>
              <dt><kbd>Esc</kbd></dt>
              <dd>Go back one step, before locking</dd>
            </div>
          ) : null}
          {stage === 'evidence' ? (
            <div>
              <dt><kbd>1</kbd>&ndash;<kbd>5</kbd></dt>
              <dd>Toggle an evidence signal</dd>
            </div>
          ) : null}
          {stage === 'followup' && hasNumberedResponses ? (
            <div>
              <dt><kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd>&hellip;</dt>
              <dd>Choose a response</dd>
            </div>
          ) : null}
          <div>
            <dt><kbd>?</kbd></dt>
            <dd>Show or hide this panel</dd>
          </div>
        </dl>
        <p className="shortcuts-note">Locking a call always needs the Lock button.</p>
      </div>
    </dialog>
  )
}

type AppPage = 'today' | 'cases' | 'progress' | 'settings' | 'privacy' | 'terms' | 'cookies' | 'not-found'

function getInitialPage(): AppPage {
  const path = window.location.pathname
  if (path === '/' || path === '') return 'today'
  if (path === '/cases') return 'cases'
  if (path === '/progress') return 'progress'
  if (path === '/settings') return 'settings'
  if (path === '/privacy') return 'privacy'
  if (path === '/terms') return 'terms'
  if (path === '/cookies') return 'cookies'

  return 'not-found'
}

export function App() {
  const isOnline = useOnlineStatus()
  const [page, setPage] = useState<AppPage>(getInitialPage)
  const [today, setToday] = useState<TodayState>({ kind: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const mainRef = useRef<HTMLElement>(null)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [activeAttempt, setActiveAttempt] = useState<{
    readonly data: AttemptData
    readonly csrfToken: string
    readonly caseNumber: number
    readonly editionDate: string
  } | null>(null)

  const navigate = useCallback((target: AppPage): void => {
    const path = target === 'today' ? '/' : `/${target}`
    window.history.pushState(null, '', path)
    setPage(target)
    window.scrollTo(0, 0)
    requestAnimationFrame(() => mainRef.current?.focus())
  }, [])

  useEffect(() => {
    if (activeAttempt) {
      document.title = 'Case in progress — Roundcraft'
      return
    }
    const titles: Record<AppPage, string> = {
      today: 'Today — Roundcraft',
      cases: 'Cases — Roundcraft',
      progress: 'Progress — Roundcraft',
      settings: 'Settings — Roundcraft',
      privacy: 'Privacy policy — Roundcraft',
      terms: 'Terms and conditions — Roundcraft',
      cookies: 'Cookies policy — Roundcraft',
      'not-found': 'Not found — Roundcraft',
    }
    document.title = titles[page]
  }, [page, activeAttempt])

  useEffect(() => {
    function handlePopState(): void {
      setPage(getInitialPage())
      window.scrollTo(0, 0)
      requestAnimationFrame(() => mainRef.current?.focus())
    }

    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

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

  useEffect(() => {
    let hiddenAt: number | null = null
    const staleThresholdMs = 5 * 60 * 1000

    function handleVisibility() {
      if (document.hidden) {
        hiddenAt = Date.now()
      } else if (hiddenAt && Date.now() - hiddenAt > staleThresholdMs) {
        hiddenAt = null
        setReloadKey((k) => k + 1)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

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
      setActiveAttempt({
        data: attempt,
        csrfToken: session.csrf_token,
        caseNumber: availableEdition.case_number,
        editionDate: availableEdition.edition_date_utc,
      })
      void recordEvent('attempt_issued', { edition_id: availableEdition.edition_id, mode: 'official' }, session.csrf_token)
    } catch {
      setStatusMessage(
        navigator.onLine
          ? 'The case could not be started. Try again in a moment; if it keeps failing, report an issue from the footer.'
          : 'You appear to be offline. Reconnect, then start the case again.',
      )
    } finally {
      setIsCreatingSession(false)
    }
  }

  const availableEdition =
    today.kind === 'ready' && today.data.availability === 'available'
      ? today.data.edition
      : null

  const primaryLabel = (() => {
    if (!availableEdition) return 'Start case'
    switch (availableEdition.primary_action) {
      case 'continue':
        return 'Continue case'
      case 'view_debrief':
        return 'View debrief'
      case 'review':
        return 'Review result'
      default:
        return 'Start case'
    }
  })()

  const statusLabel = (() => {
    if (!availableEdition) return ''
    switch (availableEdition.status) {
      case 'in_progress':
        return 'In progress'
      case 'decision_complete':
        return 'Decision complete'
      case 'complete':
        return 'Complete'
      default:
        return ''
    }
  })()

  function handleNavClick(
    event: React.MouseEvent<HTMLAnchorElement>,
    target: AppPage,
  ): void {
    event.preventDefault()
    navigate(target)
  }

  if (activeAttempt) {
    return (
      <AttemptExperience
        data={activeAttempt.data}
        csrfToken={activeAttempt.csrfToken}
        caseNumber={activeAttempt.caseNumber}
        editionDate={activeAttempt.editionDate}
        onExit={() => {
          setActiveAttempt(null)
          setReloadKey((k) => k + 1)
          window.scrollTo(0, 0)
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      {!isOnline ? (
        <p className="offline-banner" role="alert">
          You are offline. Some features may be unavailable.
        </p>
      ) : null}
      <header className="site-header">
        <a
          className="wordmark"
          href="/"
          onClick={(e) => handleNavClick(e, 'today')}
          aria-label="Roundcraft home"
        >
          Roundcraft
        </a>
        <nav aria-label="Primary navigation">
          <a
            aria-current={page === 'today' ? 'page' : undefined}
            href="/"
            onClick={(e) => handleNavClick(e, 'today')}
          >
            Today
          </a>
          <a
            aria-current={page === 'cases' ? 'page' : undefined}
            href="/cases"
            onClick={(e) => handleNavClick(e, 'cases')}
          >
            Cases
          </a>
          <a
            aria-current={page === 'progress' ? 'page' : undefined}
            href="/progress"
            onClick={(e) => handleNavClick(e, 'progress')}
          >
            Progress
          </a>
          <a
            aria-current={page === 'settings' ? 'page' : undefined}
            href="/settings"
            onClick={(e) => handleNavClick(e, 'settings')}
          >
            Settings
          </a>
        </nav>
      </header>

      <main id="main-content" ref={mainRef} tabIndex={-1}>
        {page === 'cases' ? <CasesPage /> : null}
        {page === 'progress' ? <ProgressPage onNavigateToday={() => navigate('today')} /> : null}
        {page === 'settings' ? <SettingsPage /> : null}
        {page === 'privacy' ? <PrivacyPolicyPage /> : null}
        {page === 'terms' ? <TermsPage /> : null}
        {page === 'cookies' ? <CookiesPolicyPage /> : null}

        {page === 'not-found' ? (
          <section className="page-state" aria-labelledby="not-found-title">
            <p className="eyebrow">404</p>
            <h1 id="not-found-title">Page not found</h1>
            <p className="case-intro">
              The page you are looking for does not exist.
            </p>
            <a
              className="inline-nav-link"
              href="/"
              onClick={(e) => { e.preventDefault(); navigate('today') }}
            >
              Go to Today
            </a>
          </section>
        ) : null}

        {page === 'today' ? (
          <>
            {today.kind === 'loading' ? (
              <section className="case-cover case-skeleton" aria-live="polite" aria-busy="true">
                <div className="case-kicker">
                  <span className="skel skel-text-s">&nbsp;</span>
                  <span className="skel skel-text-s">&nbsp;</span>
                </div>
                <div className="case-copy">
                  <p className="eyebrow"><span className="skel skel-text-m">&nbsp;</span></p>
                  <h1><span className="skel skel-text-l">&nbsp;</span></h1>
                  <p className="case-intro"><span className="skel skel-text-l">&nbsp;</span></p>
                </div>
                <dl className="case-metadata">
                  <div><dt className="skel skel-text-s">&nbsp;</dt><dd className="skel skel-text-m">&nbsp;</dd></div>
                  <div><dt className="skel skel-text-s">&nbsp;</dt><dd className="skel skel-text-m">&nbsp;</dd></div>
                  <div><dt className="skel skel-text-s">&nbsp;</dt><dd className="skel skel-text-m">&nbsp;</dd></div>
                </dl>
                <div className="case-actions">
                  <span className="skel skel-button">&nbsp;</span>
                </div>
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
                  <h1 id="today-title">Today's tactical case</h1>
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
                  {statusLabel ? (
                    <div>
                      <dt>Status</dt>
                      <dd><span className="status-badge" data-status={availableEdition.status}>{statusLabel}</span></dd>
                    </div>
                  ) : null}
                </dl>

                <div className="case-actions">
                  <button
                    type="button"
                    disabled={isCreatingSession}
                    onClick={() => void handleStart()}
                  >
                    {isCreatingSession ? 'Loading…' : primaryLabel}
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
          </>
        ) : null}
      </main>

      <footer>
        <div className="footer-nav">
          <a
            aria-current={page === 'today' ? 'page' : undefined}
            href="/"
            onClick={(e) => handleNavClick(e, 'today')}
          >
            Today
          </a>
          <a
            aria-current={page === 'cases' ? 'page' : undefined}
            href="/cases"
            onClick={(e) => handleNavClick(e, 'cases')}
          >
            Cases
          </a>
          <a
            aria-current={page === 'progress' ? 'page' : undefined}
            href="/progress"
            onClick={(e) => handleNavClick(e, 'progress')}
          >
            Progress
          </a>
          <a
            aria-current={page === 'settings' ? 'page' : undefined}
            href="/settings"
            onClick={(e) => handleNavClick(e, 'settings')}
          >
            Settings
          </a>
        </div>
        <div className="footer-legal">
          <a href="/privacy" onClick={(e) => handleNavClick(e, 'privacy')}>Privacy</a>
          <a href="/terms" onClick={(e) => handleNavClick(e, 'terms')}>Terms</a>
          <a href="/cookies" onClick={(e) => handleNavClick(e, 'cookies')}>Cookies</a>
        </div>
        <div className="footer-info">
          <p>Built for deliberate CS2 decisions, not reaction speed.</p>
          <p>Roundcraft · Independent project in closed beta · <a href="https://github.com/WhiteBlindness/roundcraft/issues">Report an issue</a></p>
        </div>
      </footer>
    </div>
  )
}
