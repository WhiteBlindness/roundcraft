import { useEffect, useRef, useState } from 'react'

import type { PublicBrief } from '../domain/public-brief'
import {
  completeDebrief,
  commitFollowupAnswer,
  createFairnessReport,
  type FairnessCategory,
  type FollowupAnswerDraft,
  type FollowupCommitData,
  type MainCommitData,
  recordEvent,
} from './api'

const idempotencyKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function loadFollowupIdempotencyKey(attemptId: string): string {
  try {
    const stored = localStorage.getItem(`roundcraft:followup-key:${attemptId}`)
    if (stored && idempotencyKeyPattern.test(stored)) return stored
  } catch {
    // Storage is an optional recovery aid; the server remains authoritative.
  }

  return crypto.randomUUID()
}

function optionLabel(
  options: readonly { readonly id: string; readonly label: string }[],
  id: string,
): string {
  return options.find((option) => option.id === id)?.label ?? ''
}

const fairnessCategories: readonly { key: FairnessCategory; label: string }[] = [
  { key: 'missing_action', label: 'Missing action' },
  { key: 'missing_qualifier', label: 'Missing qualifier' },
  { key: 'missing_evidence', label: 'Missing evidence' },
  { key: 'incorrect_disclosed_fact', label: 'Incorrect disclosed fact' },
  { key: 'other', label: 'Other' },
]

interface FollowupExperienceProps {
  readonly attemptId: string
  readonly csrfToken: string
  readonly caseNumber: number
  readonly editionDate: string
  readonly brief: PublicBrief
  readonly mainCommit: MainCommitData
  readonly initialResult: FollowupCommitData | null
  readonly initialReviewCompleted: boolean
  readonly onExit: () => void
  readonly onStageChange: (stage: 'followup' | 'debrief') => void
}

type FollowupStage = 'answer' | 'review' | 'debrief'

export function FollowupExperience({
  attemptId,
  csrfToken,
  caseNumber,
  editionDate,
  brief,
  mainCommit,
  initialResult,
  initialReviewCompleted,
  onExit,
  onStageChange,
}: FollowupExperienceProps) {
  const followup = mainCommit.followup
  const initialAnswer = initialResult?.followup_answer
  const [stage, setStage] = useState<FollowupStage>(
    initialResult ? 'debrief' : 'answer',
  )
  const [responseId, setResponseId] = useState(
    initialAnswer?.type === 'new_information' ? initialAnswer.response_id : '',
  )
  const [postureId, setPostureId] = useState(
    initialAnswer?.type === 'economy_risk' ? initialAnswer.posture_id : '',
  )
  const [priorityId, setPriorityId] = useState(
    initialAnswer?.type === 'economy_risk' ? initialAnswer.priority_id : '',
  )
  const [result, setResult] = useState<FollowupCommitData | null>(initialResult)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionStarted, setSubmissionStarted] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [reviewCompleted, setReviewCompleted] = useState(
    initialReviewCompleted,
  )
  const [isCompletingReview, setIsCompletingReview] = useState(false)
  const [completionStarted, setCompletionStarted] = useState(false)
  const [completionError, setCompletionError] = useState<string | null>(null)
  const idempotencyKey = useRef(loadFollowupIdempotencyKey(attemptId))
  const answerHeading = useRef<HTMLHeadingElement>(null)
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const debriefHeading = useRef<HTMLHeadingElement>(null)
  const [fairnessCategory, setFairnessCategory] = useState<FairnessCategory | null>(null)
  const [fairnessStatus, setFairnessStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'shared' | 'error'>('idle')

  function buildShareText(): string {
    if (!result) return ''
    const [year, month, day] = editionDate.split('-')
    const confidenceLabel = optionLabel(brief.confidence, result.result.confidence_id)
    return [
      `Roundcraft · Case ${String(caseNumber).padStart(3, '0')} · ${day}/${month}/${year}`,
      `Score: ${result.result.total}/100`,
      `Main: ${result.result.components.main}/50 · Evidence: ${result.result.components.evidence}/20 · Follow-up: ${result.result.components.followup}/30`,
      `Confidence: ${confidenceLabel}`,
    ].join('\n')
  }

  async function handleShare(): Promise<void> {
    const text = buildShareText()
    if (!text) return

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text })
        setShareStatus('shared')
        void recordEvent('share_invoked', { mode: 'official', surface: 'web_share' }, csrfToken)
        return
      } catch {
        // User cancelled or API failed; fall through to clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(text)
      setShareStatus('copied')
      void recordEvent('share_invoked', { mode: 'official', surface: 'clipboard' }, csrfToken)
    } catch {
      setShareStatus('error')
    }
  }

  useEffect(() => {
    try {
      localStorage.setItem(
        `roundcraft:followup-key:${attemptId}`,
        idempotencyKey.current,
      )
    } catch {
      // A blocked local recovery aid must not block the official attempt.
    }
  }, [attemptId])

  useEffect(() => {
    if (stage === 'answer') answerHeading.current?.focus()
    if (stage === 'review') reviewHeading.current?.focus()
    if (stage === 'debrief') debriefHeading.current?.focus()
    onStageChange(stage === 'debrief' ? 'debrief' : 'followup')
  }, [onStageChange, stage])

  const selectedAnswer: FollowupAnswerDraft | null = (() => {
    if (followup.type === 'new_information' && responseId) {
      return {
        case_revision: followup.caseRevision,
        type: 'new_information',
        response_id: responseId,
      }
    }

    if (followup.type === 'economy_risk' && postureId && priorityId) {
      return {
        case_revision: followup.caseRevision,
        type: 'economy_risk',
        posture_id: postureId,
        priority_id: priorityId,
      }
    }

    return null
  })()

  const selectedAnswerLabel = (() => {
    if (followup.type === 'new_information') {
      return optionLabel(followup.responses, responseId)
    }

    return [
      optionLabel(followup.postures, postureId),
      optionLabel(followup.priorities, priorityId),
    ]
      .filter(Boolean)
      .join(' · ')
  })()

  async function lockFollowup(): Promise<void> {
    if (!selectedAnswer) return

    setIsSubmitting(true)
    setSubmissionStarted(true)
    setSubmissionError(null)

    try {
      const committed = await commitFollowupAnswer(
        attemptId,
        csrfToken,
        idempotencyKey.current,
        selectedAnswer,
      )
      setResult(committed)
      try {
        localStorage.removeItem(`roundcraft:followup-key:${attemptId}`)
      } catch {
        // The accepted server state does not depend on local storage cleanup.
      }
      setStage('debrief')
      void recordEvent('followup_committed', { mode: 'official' }, csrfToken)
      void recordEvent('decision_complete', { mode: 'official' }, csrfToken)
    } catch {
      setSubmissionError(
        'The result acknowledgement was not received. Retry the same result.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitFairnessReport(): Promise<void> {
    if (!fairnessCategory) return

    setFairnessStatus('submitting')

    try {
      await createFairnessReport(attemptId, fairnessCategory, csrfToken)
      setFairnessStatus('submitted')
      void recordEvent('fairness_reported', { mode: 'official' }, csrfToken)
    } catch {
      setFairnessStatus('error')
    }
  }

  async function finishReview(): Promise<void> {
    setIsCompletingReview(true)
    setCompletionStarted(true)
    setCompletionError(null)

    try {
      await completeDebrief(attemptId, csrfToken)
      setReviewCompleted(true)
      void recordEvent('debrief_complete', { mode: 'official' }, csrfToken)
    } catch {
      setCompletionError(
        'The completion acknowledgement was not received. Retry the same action.',
      )
    } finally {
      setIsCompletingReview(false)
    }
  }

  const lockedLine = (
    <div className="locked-line">
      <span>Main locked</span>
      <p>
        {optionLabel(brief.actions, mainCommit.main_answer.action_id)} ·{' '}
        {optionLabel(brief.qualifiers, mainCommit.main_answer.qualifier_id)}
      </p>
    </div>
  )

  if (stage === 'answer') {
    return (
      <section className="followup-screen" aria-labelledby="followup-title">
        {lockedLine}
        <div className="decision-heading">
          <h1 id="followup-title" ref={answerHeading} tabIndex={-1}>
            {followup.heading}
          </h1>
          <p>{followup.stimulus}</p>
        </div>
        <ul className="followup-updates">
          {followup.updates.map((update) => (
            <li key={update.id}>
              <span>{update.status}</span>
              <p>{update.text}</p>
            </li>
          ))}
        </ul>

        {followup.type === 'new_information' ? (
          <fieldset className="choice-group followup-choice">
            <legend>Your response</legend>
            {followup.responses.map((response) => (
              <label key={response.id}>
                <input
                  type="radio"
                  name="followup-response"
                  value={response.id}
                  checked={responseId === response.id}
                  onChange={() => setResponseId(response.id)}
                />
                <span>{response.label}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className="decision-form followup-form">
            <fieldset className="choice-group">
              <legend>Risk posture</legend>
              {followup.postures.map((posture) => (
                <label key={posture.id}>
                  <input
                    type="radio"
                    name="risk-posture"
                    value={posture.id}
                    checked={postureId === posture.id}
                    onChange={() => setPostureId(posture.id)}
                  />
                  <span>{posture.label}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="choice-group">
              <legend>Allocation priority</legend>
              {followup.priorities.map((priority) => (
                <label key={priority.id}>
                  <input
                    type="radio"
                    name="allocation-priority"
                    value={priority.id}
                    checked={priorityId === priority.id}
                    onChange={() => setPriorityId(priority.id)}
                  />
                  <span>{priority.label}</span>
                </label>
              ))}
            </fieldset>
          </div>
        )}

        <div className="attempt-actions">
          <p>Review the update before it becomes permanent.</p>
          <button
            type="button"
            disabled={!selectedAnswer}
            onClick={() => setStage('review')}
          >
            Review update
          </button>
        </div>
      </section>
    )
  }

  if (stage === 'review') {
    return (
      <section className="review-screen" aria-labelledby="followup-review-title">
        <div className="decision-heading">
          <h1 id="followup-review-title" ref={reviewHeading} tabIndex={-1}>
            Review your update
          </h1>
          <p>Check the second official decision before it becomes permanent.</p>
        </div>
        <dl className="review-ledger">
          <div>
            <dt>Locked original line</dt>
            <dd>
              {optionLabel(brief.actions, mainCommit.main_answer.action_id)} ·{' '}
              {optionLabel(
                brief.qualifiers,
                mainCommit.main_answer.qualifier_id,
              )}
            </dd>
          </div>
          <div>
            <dt>New stimulus</dt>
            <dd>{followup.stimulus}</dd>
          </div>
          <div>
            <dt>Follow-up response</dt>
            <dd>{selectedAnswerLabel}</dd>
          </div>
        </dl>
        <p className="permanence-notice">
          You cannot change this official update after it is locked.
        </p>
        {submissionStarted ? (
          <div className="result-pending" role="status">
            <strong>Result pending</strong>
            <p>Your update is frozen while the result is recovered.</p>
          </div>
        ) : null}
        {submissionError ? (
          <p className="submission-error" role="alert">
            {submissionError}
          </p>
        ) : null}
        <div className="review-actions">
          {!submissionStarted ? (
            <button
              className="back-action"
              type="button"
              onClick={() => setStage('answer')}
            >
              Edit update
            </button>
          ) : null}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void lockFollowup()}
          >
            {isSubmitting
              ? 'Submitting…'
              : submissionStarted
                ? 'Retry result'
                : 'Lock follow-up'}
          </button>
        </div>
      </section>
    )
  }

  if (!result) return null

  return (
    <section className="debrief-screen" aria-labelledby="debrief-title">
      <header className="debrief-opening">
        <h1 id="debrief-title" ref={debriefHeading} tabIndex={-1}>
          What actually happened
        </h1>
        <p>This is the authored round record. It did not change because of your answer.</p>
      </header>

      <ol className="continuation-list">
        {result.reveal.continuation.events.map((event) => (
          <li key={`${event.timestamp}-${event.action}`}>
            <time>{event.timestamp}</time>
            <div>
              <strong>{event.action}</strong>
              <p>{event.consequence}</p>
              <p>{event.state}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="result-summary" aria-labelledby="result-title">
        <div>
          <h2 id="result-title">How the line was judged</h2>
          <p>Official decision · confidence remains unscored</p>
        </div>
        <strong className="total-score">{result.result.total}<span>/100</span></strong>
        <dl className="score-components">
          <div><dt>Main</dt><dd>{result.result.components.main}/50</dd></div>
          <div><dt>Evidence</dt><dd>{result.result.components.evidence}/20</dd></div>
          <div><dt>Follow-up</dt><dd>{result.result.components.followup}/30</dd></div>
        </dl>
        <dl className="result-bands">
          <div><dt>Main call</dt><dd>{result.result.main_band}</dd></div>
          <div><dt>Follow-up</dt><dd>{result.result.followup_band}</dd></div>
          <div>
            <dt>Confidence · unscored</dt>
            <dd>{optionLabel(brief.confidence, result.result.confidence_id)}</dd>
          </div>
          <div><dt>Participation</dt><dd>Awarded</dd></div>
        </dl>
      </section>

      <section className="comparison-section" aria-labelledby="comparison-title">
        <h2 id="comparison-title">Your line and the round record</h2>
        <div className="comparison-grid">
          <article>
            <h3>Your line</h3>
            <p>
              {optionLabel(brief.actions, mainCommit.main_answer.action_id)} ·{' '}
              {optionLabel(
                brief.qualifiers,
                mainCommit.main_answer.qualifier_id,
              )}
            </p>
            <p>{selectedAnswerLabel}</p>
          </article>
          <article>
            <h3>What actually happened</h3>
            <p>{result.reveal.comparison.roundAction}</p>
            <p>{result.reveal.comparison.materialInformation}</p>
            <p>{result.reveal.comparison.roundFollowup}</p>
          </article>
        </div>
      </section>

      <section className="tactical-debrief" aria-labelledby="analysis-title">
        <h2 id="analysis-title">Why the line received this result</h2>
        <dl>
          <div><dt>Why it works</dt><dd>{result.reveal.debrief.whyItWorks}</dd></div>
          <div><dt>Cost</dt><dd>{result.reveal.debrief.cost}</dd></div>
          <div><dt>Assumption</dt><dd>{result.reveal.debrief.assumption}</dd></div>
          <div><dt>Breaks when</dt><dd>{result.reveal.debrief.breaksWhen}</dd></div>
          <div>
            <dt>Evidence review</dt>
            <dd>
              <ul>
                {result.reveal.debrief.evidenceReview.map((item) => (
                  <li key={item.evidenceId}>{item.explanation}</li>
                ))}
              </ul>
            </dd>
          </div>
          <div><dt>Follow-up review</dt><dd>{result.reveal.debrief.followupReview}</dd></div>
          <div><dt>Strongest alternative</dt><dd>{result.reveal.debrief.strongestAlternative}</dd></div>
          <div>
            <dt>One-variable counterfactual</dt>
            <dd>
              {result.reveal.debrief.counterfactual.changedFact}{' '}
              {result.reveal.debrief.counterfactual.effect}
            </dd>
          </div>
          <div>
            <dt>Sources and method</dt>
            <dd>
              <p>{result.reveal.debrief.method}</p>
              <ul>
                {result.reveal.debrief.sources.map((source) => (
                  <li key={source.label}><strong>{source.label}:</strong> {source.detail}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </section>

      <section className="principle-card" aria-labelledby="principle-title">
        <h2 id="principle-title">What to remember from this round</h2>
        <p>{result.reveal.principle}</p>
      </section>

      <section className="review-completion" aria-live="polite">
        {reviewCompleted ? (
          <>
            <div>
              <strong>Review complete</strong>
              <p>The final principle is now recorded with this official attempt.</p>
            </div>
            <div className="completion-actions">
              <button
                className="back-action"
                type="button"
                onClick={() => debriefHeading.current?.focus()}
              >
                Review case
              </button>
              <button type="button" onClick={() => void handleShare()}>
                {shareStatus === 'copied'
                  ? 'Copied to clipboard'
                  : shareStatus === 'shared'
                    ? 'Shared'
                    : shareStatus === 'error'
                      ? 'Could not copy'
                      : 'Share result'}
              </button>
              <button type="button" onClick={onExit}>
                Back to Today
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <strong>
                {completionError ? 'Completion pending' : 'Complete the review'}
              </strong>
              <p>
                {completionError ??
                  'Finish explicitly to record that you reached the transferable principle.'}
              </p>
            </div>
            <button
              type="button"
              disabled={isCompletingReview}
              onClick={() => void finishReview()}
            >
              {isCompletingReview
                ? 'Finishing…'
                : completionStarted
                  ? 'Retry finish review'
                  : 'Finish review'}
            </button>
          </>
        )}
      </section>

      <section className="fairness-section" aria-labelledby="fairness-title">
        <h2 id="fairness-title">Fairness</h2>
        {fairnessStatus === 'submitted' ? (
          <p className="fairness-submitted">Your report has been recorded. Thank you.</p>
        ) : (
          <>
            <p>If the case contained an error that affected your score, select a category.</p>
            <fieldset className="fairness-options">
              <legend className="visually-hidden">Fairness concern category</legend>
              {fairnessCategories.map(({ key, label }) => (
                <label key={key}>
                  <input
                    type="radio"
                    name="fairness-category"
                    value={key}
                    checked={fairnessCategory === key}
                    onChange={() => setFairnessCategory(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            {fairnessStatus === 'error' ? (
              <p className="submission-error" role="alert">
                The report could not be submitted. Please try again.
              </p>
            ) : null}
            <button
              type="button"
              disabled={!fairnessCategory || fairnessStatus === 'submitting'}
              onClick={() => void submitFairnessReport()}
            >
              {fairnessStatus === 'submitting' ? 'Submitting...' : 'Submit report'}
            </button>
          </>
        )}
      </section>
    </section>
  )
}
