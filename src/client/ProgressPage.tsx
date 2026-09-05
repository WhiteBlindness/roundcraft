import { useEffect, useState } from 'react'

import { loadProgress, type ProgressEntry } from './api'

interface EditionMetadata {
  readonly case_number?: number
}

function editionLabel(entry: ProgressEntry): string {
  const meta = entry.metadata as EditionMetadata
  if (meta.case_number) {
    return `Case ${String(meta.case_number).padStart(3, '0')}`
  }

  return entry.edition_id
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = date.getUTCFullYear()

  return `${day}/${month}/${year}`
}

type ProgressState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly entries: readonly ProgressEntry[] }
  | { readonly kind: 'error' }

export function ProgressPage() {
  const [state, setState] = useState<ProgressState>({ kind: 'loading' })

  useEffect(() => {
    let isCurrent = true

    loadProgress()
      .then((data) => {
        if (isCurrent) setState({ kind: 'ready', entries: data.entries })
      })
      .catch(() => {
        if (isCurrent) setState({ kind: 'error' })
      })

    return () => {
      isCurrent = false
    }
  }, [])

  if (state.kind === 'loading') {
    return (
      <section className="page-state" aria-live="polite">
        <p className="eyebrow">Progress</p>
        <h1>Loading history</h1>
      </section>
    )
  }

  if (state.kind === 'error') {
    return (
      <section className="page-state" aria-labelledby="progress-error">
        <p className="eyebrow">Progress</p>
        <h1 id="progress-error">No history yet</h1>
        <p className="case-intro">
          Complete your first official case to see your scored history here.
          Return to Today to start.
        </p>
      </section>
    )
  }

  const { entries } = state

  if (entries.length === 0) {
    return (
      <section className="page-state" aria-labelledby="progress-empty">
        <p className="eyebrow">Progress</p>
        <h1 id="progress-empty">No scored rounds</h1>
        <p className="case-intro">
          Complete an official case to see your scored history here.
        </p>
      </section>
    )
  }

  const totalScore = entries.reduce((sum, e) => sum + e.total_score, 0)
  const averageScore = Math.round(totalScore / entries.length)

  return (
    <section className="progress-page" aria-labelledby="progress-title">
      <header className="progress-header">
        <div>
          <p className="eyebrow">Progress</p>
          <h1 id="progress-title">Scored history</h1>
        </div>
        <dl className="progress-summary">
          <div>
            <dt>Rounds</dt>
            <dd>{entries.length}</dd>
          </div>
          <div>
            <dt>Average</dt>
            <dd>{averageScore}/100</dd>
          </div>
        </dl>
      </header>

      <div className="progress-table-wrap">
        <table className="progress-table">
          <thead>
            <tr>
              <th>Edition</th>
              <th>Date</th>
              <th>Total</th>
              <th>Main</th>
              <th>Evidence</th>
              <th>Follow-up</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.edition_id}>
                <td className="edition-cell">{editionLabel(entry)}</td>
                <td>{formatDate(entry.issued_at)}</td>
                <td className="score-cell">
                  <strong>{entry.total_score}</strong>
                </td>
                <td className="score-cell">{entry.display_main}</td>
                <td className="score-cell">{entry.display_evidence}</td>
                <td className="score-cell">{entry.display_followup}</td>
                <td>
                  <span className="state-badge" data-state={entry.state}>
                    {entry.state === 'debrief_complete'
                      ? 'Complete'
                      : 'Pending debrief'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
