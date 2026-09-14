import { useCallback, useEffect, useState } from 'react'

const storageKey = 'roundcraft_cookie_consent'

type ConsentState = 'pending' | 'accepted' | 'rejected'

function readConsent(): ConsentState {
  try {
    const value = localStorage.getItem(storageKey)
    if (value === 'accepted' || value === 'rejected') return value
  } catch { /* private browsing */ }
  return 'pending'
}

export function CookieConsent() {
  const [consent, setConsent] = useState<ConsentState>(readConsent)

  useEffect(() => {
    if (consent === 'pending') return
    try { localStorage.setItem(storageKey, consent) } catch { /* ignore */ }
  }, [consent])

  const accept = useCallback(() => setConsent('accepted'), [])
  const reject = useCallback(() => setConsent('rejected'), [])

  if (consent !== 'pending') return null

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie consent">
      <p>
        This site uses a single essential cookie to maintain your anonymous
        session. No tracking or advertising cookies are used.{' '}
        <a href="/cookies" onClick={(e) => {
          e.preventDefault()
          window.history.pushState(null, '', '/cookies')
          window.dispatchEvent(new PopStateEvent('popstate'))
        }}>
          Learn more
        </a>
      </p>
      <div className="cookie-actions">
        <button type="button" onClick={accept}>
          Accept
        </button>
        <button type="button" className="cookie-reject" onClick={reject}>
          Decline non-essential
        </button>
      </div>
    </div>
  )
}
