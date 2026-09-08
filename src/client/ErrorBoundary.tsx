import { Component, type ReactNode } from 'react'

interface Props {
  readonly children: ReactNode
}

interface State {
  readonly hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-shell">
          <main>
            <section className="page-state" aria-labelledby="error-title">
              <p className="eyebrow">Error</p>
              <h1 id="error-title">Something went wrong</h1>
              <p className="case-intro">
                The application encountered an unexpected error.
              </p>
              <button
                className="secondary-action"
                type="button"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </section>
          </main>
        </div>
      )
    }

    return this.props.children
  }
}
