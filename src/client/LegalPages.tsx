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

export function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy policy" lastUpdated="14/09/2026">
      <section>
        <h2>Overview</h2>
        <p>
          Roundcraft is a free tactical decision-making training platform for
          Counter-Strike 2. We are committed to protecting your privacy and
          processing only the minimum data necessary for the service to function.
        </p>
      </section>

      <section>
        <h2>Data controller</h2>
        <p>
          Roundcraft is operated as an independent project. For questions about
          your data, contact us at{' '}
          <a href="mailto:privacy@roundcraft.gg">privacy@roundcraft.gg</a>.
        </p>
      </section>

      <section>
        <h2>Data we collect</h2>
        <p>We collect only what is necessary to provide the service:</p>
        <ul>
          <li>
            <strong>Anonymous session identifier</strong> — a randomly generated
            token stored in a secure, HTTP-only cookie. It contains no personal
            information and cannot be used to identify you.
          </li>
          <li>
            <strong>Game state</strong> — your tactical decisions, answers, and
            progress within cases. This is linked to your anonymous session, not
            to any personal identity.
          </li>
          <li>
            <strong>Usage events</strong> — anonymous interaction events (e.g.
            case started, decision submitted) retained for 90 days to improve
            the service. No IP addresses, device fingerprints, or personal data
            are included.
          </li>
          <li>
            <strong>Local draft storage</strong> — in-progress work is saved in
            your browser's IndexedDB. This data never leaves your device.
          </li>
        </ul>
      </section>

      <section>
        <h2>Data we do not collect</h2>
        <ul>
          <li>Names, email addresses, or account credentials</li>
          <li>IP addresses (at the application level)</li>
          <li>Device fingerprints or tracking identifiers</li>
          <li>Payment or financial information</li>
          <li>Location data</li>
        </ul>
        <p>
          Note: our hosting provider (Cloudflare) may process IP addresses at
          the infrastructure level for security and performance purposes, in
          accordance with their own privacy policy.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          We use a single essential cookie (<code>__Host-roundcraft</code>) to
          maintain your anonymous session. This cookie is:
        </p>
        <ul>
          <li>HTTP-only (not accessible to JavaScript)</li>
          <li>Secure (transmitted only over HTTPS)</li>
          <li>SameSite=Strict (not sent with cross-site requests)</li>
          <li>Valid for 90 days</li>
        </ul>
        <p>
          We do not use any tracking, advertising, or analytics cookies. See
          our <a href="/cookies">cookies policy</a> for full details.
        </p>
      </section>

      <section>
        <h2>Third-party services</h2>
        <p>
          Roundcraft is hosted on Cloudflare Workers with Cloudflare D1 as the
          database. No third-party analytics, advertising, or social media
          services are embedded in the application.
        </p>
      </section>

      <section>
        <h2>Data retention</h2>
        <ul>
          <li>Session identifiers expire after 90 days of inactivity.</li>
          <li>Usage events are automatically deleted after 90 days.</li>
          <li>Game state is retained as long as the session is active.</li>
          <li>Local drafts persist in your browser until you clear them.</li>
        </ul>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          Because we do not collect personal data, most data subject rights
          under the GDPR (access, rectification, portability) do not apply in
          the traditional sense. However:
        </p>
        <ul>
          <li>
            You can delete all your game history through the Settings page.
          </li>
          <li>
            You can clear your browser cookies and IndexedDB data at any time.
          </li>
          <li>
            You can contact us at{' '}
            <a href="mailto:privacy@roundcraft.gg">privacy@roundcraft.gg</a>{' '}
            with any privacy questions.
          </li>
        </ul>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          Roundcraft is not directed at children under 16. We do not knowingly
          collect data from children.
        </p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>
          We may update this policy to reflect changes in our practices. The
          date at the top of this page indicates the last revision.
        </p>
      </section>
    </LegalPageShell>
  )
}

export function TermsPage() {
  return (
    <LegalPageShell title="Terms and conditions" lastUpdated="14/09/2026">
      <section>
        <h2>Acceptance of terms</h2>
        <p>
          By accessing and using Roundcraft, you agree to these terms and
          conditions. If you do not agree, please do not use the service.
        </p>
      </section>

      <section>
        <h2>Description of service</h2>
        <p>
          Roundcraft is a free, browser-based tactical decision-making training
          tool for Counter-Strike 2. The service presents tactical scenarios
          where users make and commit decisions, receiving scored feedback on
          their performance.
        </p>
      </section>

      <section>
        <h2>User obligations</h2>
        <ul>
          <li>Use the service for its intended purpose of tactical training.</li>
          <li>Do not attempt to circumvent security measures or rate limits.</li>
          <li>Do not use automated tools to interact with the service.</li>
          <li>Do not reverse-engineer the scoring system or case content.</li>
        </ul>
      </section>

      <section>
        <h2>Intellectual property</h2>
        <p>
          All case content, scoring rubrics, and tactical scenarios are the
          intellectual property of Roundcraft. You may not reproduce,
          distribute, or create derivative works from this content without
          permission.
        </p>
        <p>
          Counter-Strike 2 is a trademark of Valve Corporation. Roundcraft is
          an independent project and is not affiliated with, endorsed by, or
          sponsored by Valve Corporation.
        </p>
      </section>

      <section>
        <h2>Service availability</h2>
        <p>
          Roundcraft is provided on an "as is" basis. We do not guarantee
          uninterrupted availability and may modify or discontinue the service
          at any time without notice.
        </p>
      </section>

      <section>
        <h2>Limitation of liability</h2>
        <p>
          Roundcraft is a training tool and does not guarantee improvement in
          competitive performance. We shall not be liable for any indirect,
          incidental, or consequential damages arising from the use of this
          service.
        </p>
      </section>

      <section>
        <h2>Fair play</h2>
        <p>
          Cases are designed to be completed individually. Sharing answers or
          case content before the edition expires undermines the integrity of
          the platform and may result in restrictions.
        </p>
      </section>

      <section>
        <h2>Modifications</h2>
        <p>
          We reserve the right to modify these terms. Continued use of the
          service after changes constitutes acceptance of the updated terms.
        </p>
      </section>

      <section>
        <h2>Governing law</h2>
        <p>
          These terms are governed by applicable law. Any disputes shall be
          resolved through the competent courts.
        </p>
      </section>
    </LegalPageShell>
  )
}

export function CookiesPolicyPage() {
  return (
    <LegalPageShell title="Cookies policy" lastUpdated="14/09/2026">
      <section>
        <h2>What are cookies</h2>
        <p>
          Cookies are small text files stored on your device by your browser.
          They allow websites to maintain state between page visits.
        </p>
      </section>

      <section>
        <h2>Cookies we use</h2>
        <p>Roundcraft uses a single essential cookie:</p>
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
                <td>Essential</td>
                <td>90 days</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          This cookie is strictly necessary for the service to function. It
          does not contain personal information and cannot be used to track you
          across websites.
        </p>
      </section>

      <section>
        <h2>Cookies we do not use</h2>
        <ul>
          <li>No analytics cookies</li>
          <li>No advertising or remarketing cookies</li>
          <li>No social media cookies</li>
          <li>No third-party cookies of any kind</li>
        </ul>
      </section>

      <section>
        <h2>Local storage</h2>
        <p>
          Roundcraft uses your browser's IndexedDB to save draft progress
          (in-progress selections) locally. This data stays on your device and
          is never transmitted to our servers. You can clear it through your
          browser settings.
        </p>
        <p>
          A small localStorage entry records your cookie consent preference.
        </p>
      </section>

      <section>
        <h2>Managing cookies</h2>
        <p>
          You can delete or block cookies through your browser settings.
          Blocking the session cookie will prevent you from using case features
          that require a session.
        </p>
      </section>
    </LegalPageShell>
  )
}

export function RefundPolicyPage() {
  return (
    <LegalPageShell title="Refund policy" lastUpdated="14/09/2026">
      <section>
        <h2>Free service</h2>
        <p>
          Roundcraft is currently provided entirely free of charge. There are
          no purchases, subscriptions, or paid features.
        </p>
      </section>

      <section>
        <h2>No payments collected</h2>
        <p>
          Because no payment is required to use Roundcraft, there are no
          transactions to refund. We do not collect any payment information,
          credit card details, or billing data.
        </p>
      </section>

      <section>
        <h2>Future changes</h2>
        <p>
          If paid features are introduced in the future, this policy will be
          updated to include refund terms before any payments are accepted.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          If you have questions about this policy, contact us at{' '}
          <a href="mailto:support@roundcraft.gg">support@roundcraft.gg</a>.
        </p>
      </section>
    </LegalPageShell>
  )
}
