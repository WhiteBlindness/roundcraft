interface LegalPageShellProps {
  readonly title: string
  readonly lastUpdated: string
  readonly children: React.ReactNode
}

function LegalPageShell({ title, lastUpdated, children }: LegalPageShellProps) {
  return (
    <article className="legal-page" aria-labelledby="legal-title">
      <header className="legal-header">
        <p className="eyebrow">Legal</p>
        <h1 id="legal-title">{title}</h1>
        <p className="legal-updated">Last updated: {lastUpdated}</p>
      </header>
      <div className="legal-body">
        {children}
      </div>
    </article>
  )
}

const issuesUrl = 'https://github.com/WhiteBlindness/roundcraft/issues'
const lastUpdated = '29/09/2026'

function ContactSection() {
  return (
    <section>
      <h2>Questions and requests</h2>
      <p>
        Roundcraft is an independent, non-commercial project in closed beta. It
        has no published operator address or contact mailbox yet. For questions,
        use the public{' '}
        <a href={issuesUrl} rel="noreferrer noopener" target="_blank">
          issue tracker
        </a>
        {' '}(please do not post personal information there). To remove your
        data, use <strong>Delete history</strong> in{' '}
        <a href="/settings">Settings</a>.
      </p>
    </section>
  )
}

export function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy policy" lastUpdated={lastUpdated}>
      <section>
        <h2>Overview</h2>
        <p>
          Roundcraft is a free CS2 game-sense training app. It has no accounts,
          no payments, no advertising and no third-party analytics or scripts.
          This page describes what the app stores.
        </p>
      </section>

      <section>
        <h2>What is stored</h2>
        <ul>
          <li>
            <strong>Anonymous session</strong>: a random identifier kept in one
            strictly necessary cookie, <code>__Host-roundcraft</code>. It
            expires 90 days after it is created.
          </li>
          <li>
            <strong>Attempts and scores</strong>: your answers and results,
            linked to that anonymous session only.
          </li>
          <li>
            <strong>Usage events</strong>: our own first-party endpoint records
            an event name, the case (edition) id, the mode and a few small
            properties. Events carry no IP address and no user identifier, and
            are kept for 90 days.
          </li>
          <li>
            <strong>Drafts and theme, on your device</strong>: in-progress
            answers are saved in your browser's IndexedDB and your theme choice
            in localStorage (<code>roundcraft_theme</code>). Neither is sent to
            a server.
          </li>
        </ul>
      </section>

      <section>
        <h2>IP addresses</h2>
        <p>
          The rate limiter reads your IP address from the request, briefly, to
          count requests. The application does not store it. Cloudflare hosts
          the service and may process IP addresses as the hosting provider under
          its own policies.
        </p>
      </section>

      <section>
        <h2>What we do not collect</h2>
        <p>
          Names, email addresses, passwords, payment details, advertising
          identifiers or fingerprints. We do not sell your data or share it with advertisers.
        </p>
      </section>

      <section>
        <h2>Deleting your data</h2>
        <p>
          <strong>Delete history</strong> in <a href="/settings">Settings</a>{' '}
          removes your attempts, scores and session data from the service. You
          can also clear the cookie, localStorage and IndexedDB in your browser.
          See the <a href="/cookies">cookies policy</a> for details.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          Roundcraft is not directed at children under 16 and does not
          knowingly collect their data.
        </p>
      </section>

      <ContactSection />

      <section>
        <h2>Changes</h2>
        <p>
          This is a closed beta and this policy may change. The date at the top
          shows the last revision.
        </p>
      </section>
    </LegalPageShell>
  )
}

export function TermsPage() {
  return (
    <LegalPageShell title="Terms and conditions" lastUpdated={lastUpdated}>
      <section>
        <h2>The service</h2>
        <p>
          Roundcraft is a free, independent, non-commercial CS2 game-sense
          training tool, currently in closed beta. It presents round scenarios,
          asks you to commit to a call and gives scored feedback. There are no
          payments, purchases or subscriptions.
        </p>
      </section>

      <section>
        <h2>Using it</h2>
        <ul>
          <li>Use it for personal training and be considerate of other users.</li>
          <li>
            Do not try to disrupt the service, bypass its security measures or
            rate limits, or use automated tools against it.
          </li>
          <li>
            Official attempts are meant to be your own work; sharing answers
            defeats the point of the practice.
          </li>
        </ul>
      </section>

      <section>
        <h2>Beta status and availability</h2>
        <p>
          The service is provided as is, without warranties. It may change, be
          unavailable or be discontinued, and data may be reset during the beta.
          Scores are training feedback, not a guarantee of in-game improvement.
          To the extent the law allows, we are not liable for losses arising from
          using it.
        </p>
      </section>

      <section>
        <h2>Trademarks</h2>
        <p>
          Counter-Strike and CS2 are trademarks of Valve Corporation. Roundcraft
          is not affiliated with, endorsed by or sponsored by Valve.
        </p>
      </section>

      <ContactSection />

      <section>
        <h2>Changes</h2>
        <p>
          These terms may change during the beta. Continuing to use the service
          after a change means you accept the updated terms.
        </p>
      </section>
    </LegalPageShell>
  )
}

export function CookiesPolicyPage() {
  return (
    <LegalPageShell title="Cookies policy" lastUpdated={lastUpdated}>
      <section>
        <h2>One cookie, strictly necessary</h2>
        <p>
          Roundcraft sets a single cookie to keep your anonymous session. It is
          needed for the service to work, so no consent banner is shown.
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Purpose</th>
                <th scope="col">Type</th>
                <th scope="col">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>__Host-roundcraft</code></td>
                <td>Anonymous session identifier</td>
                <td>Strictly necessary, first-party, HttpOnly, Secure</td>
                <td>Expires 90 days after it is created</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          There are no analytics, advertising, social media or other third-party
          cookies.
        </p>
      </section>

      <section>
        <h2>Other browser storage</h2>
        <ul>
          <li>
            <strong>localStorage</strong>: <code>roundcraft_theme</code> stores
            your light, dark or system theme choice.
          </li>
          <li>
            <strong>IndexedDB</strong>: in-progress draft answers, so you can
            resume. This stays on your device.
          </li>
        </ul>
        <p>
          Neither is sent to a server or shared with third parties. Clear them
          in your browser settings at any time.
        </p>
      </section>

      <section>
        <h2>First-party usage events</h2>
        <p>
          The app sends small usage events to its own endpoint: event name, case
          id, mode and a few properties, kept for 90 days with no IP address and
          no user identifier. This does not use cookies or third-party services.
          See the <a href="/privacy">privacy policy</a>.
        </p>
      </section>

      <section>
        <h2>Managing the cookie</h2>
        <p>
          You can delete or block cookies in your browser. Without the session
          cookie you cannot start or continue official attempts. To also remove
          your history from the service, use <strong>Delete history</strong> in{' '}
          <a href="/settings">Settings</a>.
        </p>
      </section>
    </LegalPageShell>
  )
}
