import { useState } from 'react'

export function App() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

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
        <section className="case-cover" aria-labelledby="today-title">
          <div className="case-kicker">
            <span>Case 001</span>
            <span>5–8 min</span>
          </div>

          <div className="case-copy">
            <p className="eyebrow">Round reading · Resource pressure</p>
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
              <dd>01/09/2026 · UTC</dd>
            </div>
          </dl>

          <div className="case-actions">
            <button
              type="button"
              onClick={() =>
                setStatusMessage(
                  'The case service will be connected in the next implementation slice.',
                )
              }
            >
              Start case
              <span aria-hidden="true">→</span>
            </button>
            <p>Synthetic scenario — editorial tactical analysis.</p>
          </div>
        </section>

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
