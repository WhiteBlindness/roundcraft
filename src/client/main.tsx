import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { ErrorBoundary } from './ErrorBoundary'
import './styles.css'
import './debrief.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Roundcraft root element is missing')
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
