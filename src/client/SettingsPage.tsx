import { useState } from 'react'

import { createSession, deleteHistory } from './api'

type DeleteStatus = 'idle' | 'confirming' | 'deleting' | 'deleted' | 'error'

export function SettingsPage() {
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>('idle')

  async function handleDelete(): Promise<void> {
    setDeleteStatus('deleting')

    try {
      const session = await createSession()
      await deleteHistory(session.csrf_token)
      setDeleteStatus('deleted')
    } catch {
      setDeleteStatus('error')
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Manage your data and account preferences.</p>
      </div>

      <section className="settings-section" aria-labelledby="about-title">
        <h2 id="about-title">About Roundcraft</h2>
        <div className="settings-about">
          <p>
            A deliberate-practice platform for CS2 tactical decision-making.
            Study legitimate round states, commit to a line, then adapt when
            information changes.
          </p>
          <dl className="about-details">
            <div>
              <dt>Identity</dt>
              <dd>Anonymous, cookie-based</dd>
            </div>
            <div>
              <dt>Scoring</dt>
              <dd>Server-side only</dd>
            </div>
            <div>
              <dt>Build</dt>
              <dd>Foundation</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="data-title">
        <h2 id="data-title">Data management</h2>
        <div className="settings-danger-zone">
          <div className="danger-description">
            <strong>Delete all history</strong>
            <p>
              Permanently remove all your attempts, scores, and identity data.
              This action cannot be undone.
            </p>
          </div>

          {deleteStatus === 'idle' ? (
            <button
              className="danger-button"
              type="button"
              onClick={() => setDeleteStatus('confirming')}
            >
              Delete history
            </button>
          ) : null}

          {deleteStatus === 'confirming' ? (
            <div className="danger-confirm">
              <p>Are you sure? All data will be permanently removed.</p>
              <div className="danger-actions">
                <button
                  className="back-action"
                  type="button"
                  onClick={() => setDeleteStatus('idle')}
                >
                  Cancel
                </button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void handleDelete()}
                >
                  Confirm deletion
                </button>
              </div>
            </div>
          ) : null}

          {deleteStatus === 'deleting' ? (
            <p className="danger-status" role="status">Deleting all data...</p>
          ) : null}

          {deleteStatus === 'deleted' ? (
            <p className="danger-status danger-success" role="status">
              All data has been deleted. Reload the page to start fresh.
            </p>
          ) : null}

          {deleteStatus === 'error' ? (
            <div className="danger-confirm">
              <p className="danger-error" role="alert">
                The deletion could not be completed. Please try again.
              </p>
              <button
                className="danger-button"
                type="button"
                onClick={() => void handleDelete()}
              >
                Retry deletion
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
