import { useEffect, useState } from 'react'

import {
  createPracticeAttempt,
  createSession,
  loadCases,
  type CasesEdition,
  type PracticeAttemptData,
} from './api'
import type { PublicBrief } from '../domain/public-brief'

interface EditionMetadata {
  readonly case_number?: number
  readonly edition_date_utc?: string
  readonly estimated_minutes?: number
  readonly focus?: string
  readonly origin_label?: string
}

function parseMetadata(raw: Record<string, unknown>): EditionMetadata {
  return raw as EditionMetadata
}

function formatEditionDate(value: string): string {
  const [year, month, day] = value.split('-')

  return `${day}/${month}/${year}`
}

function formatReleaseDate(isoString: string): string {
  const date = new Date(isoString)
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = date.getUTCFullYear()

  return `${day}/${month}/${year}`
}

type CasesState =
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'ready'
      readonly editions: readonly CasesEdition[]
      readonly nextCursor: string | null
    }
  | { readonly kind: 'error' }

interface PracticeViewProps {
  readonly brief: PublicBrief
  readonly editionLabel: string
  readonly onBack: () => void
}

function PracticeView({ brief, editionLabel, onBack }: PracticeViewProps) {
  const [expandedAction, setExpandedAction] = useState<string | null>(null)

  function qualifierLabel(qualifierId: string): string {
    return brief.qualifiers.find((q) => q.id === qualifierId)?.label ?? qualifierId
  }

  return (
    <section className="practice-view" aria-labelledby="practice-title">
      <button className="back-action" type="button" onClick={onBack}>
        Back to cases
      </button>
      <header className="practice-header">
        <p className="eyebrow">Practice mode · {editionLabel}</p>
        <h1 id="practice-title">{brief.title}</h1>
        <p className="case-intro">{brief.focus}</p>
      </header>

      <article className="practice-facts">
        <h2>Round facts</h2>
        <ul>
          {brief.facts.map((fact) => (
            <li key={fact.id}>
              <span data-status={fact.status}>
                {fact.status === 'confirmed'
                  ? 'Confirmed'
                  : fact.status === 'last_seen'
                    ? 'Last seen'
                    : fact.status === 'inferred'
                      ? 'Inferred'
                      : 'Unknown'}
              </span>
              <p>{fact.text}</p>
            </li>
          ))}
        </ul>
      </article>

      <div className="practice-sets">
        <section>
          <h3>Actions ({brief.actions.length})</h3>
          <ul>
            {brief.actions.map((action) => {
              const isExpanded = expandedAction === action.id

              return (
                <li key={action.id} className="practice-action-item">
                  <button
                    type="button"
                    className="practice-action-toggle"
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setExpandedAction(isExpanded ? null : action.id)
                    }
                  >
                    <strong>{action.label}</strong>
                    <span>
                      {action.qualifierIds.length} qualifier
                      {action.qualifierIds.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                  {isExpanded ? (
                    <ul className="practice-qualifiers">
                      {action.qualifierIds.map((qId) => (
                        <li key={qId}>{qualifierLabel(qId)}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
        <section>
          <h3>Evidence ({brief.evidence.length})</h3>
          <ul>
            {brief.evidence.map((ev) => (
              <li key={ev.id}>{ev.label}</li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="practice-ledger" aria-label="Decision set summary">
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
      </aside>

      <p className="practice-note">
        Practice mode shows the brief only. Commit and scoring are not available
        in practice.
      </p>
    </section>
  )
}

export function CasesPage() {
  const [state, setState] = useState<CasesState>({ kind: 'loading' })
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [practiceData, setPracticeData] = useState<{
    readonly attempt: PracticeAttemptData
    readonly label: string
  } | null>(null)
  const [startingPractice, setStartingPractice] = useState<string | null>(null)
  const [practiceError, setPracticeError] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true

    loadCases()
      .then((data) => {
        if (isCurrent)
          setState({
            kind: 'ready',
            editions: data.editions,
            nextCursor: data.next_cursor ?? null,
          })
      })
      .catch(() => {
        if (isCurrent) setState({ kind: 'error' })
      })

    return () => {
      isCurrent = false
    }
  }, [])

  async function handleLoadMore(): Promise<void> {
    if (state.kind !== 'ready' || !state.nextCursor || isLoadingMore) return

    setIsLoadingMore(true)
    try {
      const data = await loadCases(state.nextCursor)
      setState({
        kind: 'ready',
        editions: [...state.editions, ...data.editions],
        nextCursor: data.next_cursor ?? null,
      })
    } catch {
      // Keep the existing data on pagination failure.
    } finally {
      setIsLoadingMore(false)
    }
  }

  async function handlePractice(editionId: string, label: string): Promise<void> {
    setStartingPractice(editionId)
    setPracticeError(null)

    try {
      const session = await createSession()
      const attempt = await createPracticeAttempt(
        editionId,
        session.csrf_token,
      )
      setPracticeData({ attempt, label })
    } catch {
      setPracticeError('The practice case could not be started.')
    } finally {
      setStartingPractice(null)
    }
  }

  if (practiceData) {
    return (
      <PracticeView
        brief={practiceData.attempt.brief}
        editionLabel={practiceData.label}
        onBack={() => setPracticeData(null)}
      />
    )
  }

  if (state.kind === 'loading') {
    return (
      <section className="page-state" aria-live="polite">
        <p className="eyebrow">Cases</p>
        <h1>Loading archive</h1>
      </section>
    )
  }

  if (state.kind === 'error') {
    return (
      <section className="page-state" aria-labelledby="cases-error">
        <p className="eyebrow">Cases</p>
        <h1 id="cases-error">Archive unavailable</h1>
        <p className="case-intro">The case archive could not be loaded.</p>
      </section>
    )
  }

  const { editions, nextCursor } = state

  if (editions.length === 0) {
    return (
      <section className="page-state" aria-labelledby="cases-empty">
        <p className="eyebrow">Cases</p>
        <h1 id="cases-empty">No released editions</h1>
        <p className="case-intro">
          Released editions will appear here once published.
        </p>
      </section>
    )
  }

  return (
    <section className="cases-page" aria-labelledby="cases-title">
      <header className="cases-header">
        <div>
          <p className="eyebrow">Archive</p>
          <h1 id="cases-title">Released cases</h1>
          <p className="case-intro">
            Browse past editions and start a practice attempt on any released case.
          </p>
        </div>
      </header>

      {practiceError ? (
        <p className="status-message" role="alert">
          {practiceError}
        </p>
      ) : null}

      <ul className="cases-list">
        {editions.map((edition) => {
          const meta = parseMetadata(edition.metadata)
          const label = meta.case_number
            ? `Case ${String(meta.case_number).padStart(3, '0')}`
            : edition.edition_id

          return (
            <li key={edition.edition_id} className="case-card">
              <div className="case-card-body">
                <div className="case-card-top">
                  <span className="case-card-id">{label}</span>
                  <span className="case-card-date">
                    {meta.edition_date_utc
                      ? formatEditionDate(meta.edition_date_utc)
                      : formatReleaseDate(edition.release_at)}
                  </span>
                  {meta.estimated_minutes ? (
                    <span className="case-card-time">
                      {meta.estimated_minutes} min
                    </span>
                  ) : null}
                </div>
                {meta.focus ? (
                  <p className="case-card-focus">{meta.focus}</p>
                ) : null}
                {meta.origin_label ? (
                  <p className="case-card-origin">{meta.origin_label}</p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={startingPractice === edition.edition_id}
                onClick={() => void handlePractice(edition.edition_id, label)}
              >
                {startingPractice === edition.edition_id
                  ? 'Starting…'
                  : 'Practice'}
              </button>
            </li>
          )
        })}
      </ul>

      {nextCursor ? (
        <div className="cases-pagination">
          <button
            className="secondary-action"
            type="button"
            disabled={isLoadingMore}
            onClick={() => void handleLoadMore()}
          >
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </section>
  )
}
