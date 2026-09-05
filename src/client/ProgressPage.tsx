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

interface ProgressPageProps {
  readonly onNavigateToday: () => void
}

export function ProgressPage({ onNavigateToday }: ProgressPageProps) {
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
      <section className="progress-page progress-skeleton" aria-live="polite" aria-busy="true">
        <header className="progress-header">
          <div>
            <p className="eyebrow"><span className="skel skel-text-s">&nbsp;</span></p>
            <h1><span className="skel skel-text-l">&nbsp;</span></h1>
          </div>
          <dl className="progress-summary">
            {[1, 2, 3].map((n) => (
              <div key={n}>
                <dt><span className="skel skel-text-s">&nbsp;</span></dt>
                <dd><span className="skel skel-text-s">&nbsp;</span></dd>
              </div>
            ))}
          </dl>
        </header>
        <div className="progress-table-wrap">
          <table className="progress-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Date</th>
                <th>Total</th>
                <th>Main</th>
                <th>Evidence</th>
                <th>Follow-up</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((n) => (
                <tr key={n}>
                  {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                    <td key={c}><span className="skel skel-text-s">&nbsp;</span></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        </p>
        <a
          className="inline-nav-link"
          href="/"
          onClick={(e) => { e.preventDefault(); onNavigateToday() }}
        >
          Go to Today
        </a>
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
        <a
          className="inline-nav-link"
          href="/"
          onClick={(e) => { e.preventDefault(); onNavigateToday() }}
        >
          Go to Today
        </a>
      </section>
    )
  }

  const totalScore = entries.reduce((sum, e) => sum + e.total_score, 0)
  const averageScore = Math.round(totalScore / entries.length)
  const bestScore = Math.max(...entries.map((e) => e.total_score))

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
          <div>
            <dt>Best</dt>
            <dd>{bestScore}/100</dd>
          </div>
        </dl>
      </header>

      <div className="progress-table-wrap">
        <table className="progress-table">
          <thead>
            <tr>
              <th>Case</th>
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
