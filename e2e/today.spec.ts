import { expect, test } from '@playwright/test'

test('Today stays neutral when no released edition exists', async ({ page }) => {
  const todayResponse = await page.request.get('/api/v1/today')

  expect(todayResponse.ok()).toBe(true)
  expect(await todayResponse.json()).toMatchObject({
    ok: true,
    data: {
      availability: 'unavailable',
      edition: null,
      primary_action: 'retry_later',
    },
  })

  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'No current case' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start case' })).toHaveCount(0)
  await expect(page.getByText('Decisive evidence')).toHaveCount(0)
})

test('a released case opens its protected briefing and evidence step', async ({
  page,
}) => {
  await page.route('**/api/v1/today', (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          availability: 'available',
          edition: {
            edition_id: 'edition_001',
            case_number: 1,
            edition_date_utc: '2026-09-01',
            estimated_minutes: 7,
            focus: 'Information',
            status: 'new',
            primary_action: 'start_case',
            origin: 'synthetic',
            origin_label: 'Synthetic scenario — editorial tactical analysis.',
          },
        },
        error: null,
        meta: { request_id: crypto.randomUUID(), api_version: 'v1' },
      },
    }),
  )
  await page.route('**/api/v1/session', (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          csrf_token: 'a'.repeat(43),
          identity_expires_at: '2026-11-30T12:00:00.000Z',
        },
        error: null,
        meta: { request_id: crypto.randomUUID(), api_version: 'v1' },
      },
    }),
  )
  await page.route('**/api/v1/attempts', (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          attempt: {
            attempt_id: 'b'.repeat(43),
            edition_id: 'edition_001',
            mode: 'official',
            state: 'issued',
            sequence: 0,
            assisted: false,
            issued_at: '2026-09-01T14:45:00.000Z',
            grace_end_at: '2026-09-02T12:00:00.000Z',
          },
          brief: {
            schemaVersion: 1,
            editionId: 'edition_001',
            caseRevision: 'case_revision_001',
            title: 'The last smoke',
            focus: 'Resource allocation under uncertainty',
            origin: 'synthetic',
            facts: [
              {
                id: 'bomb',
                status: 'confirmed',
                text: 'The bomb is down outside B.',
              },
              {
                id: 'anchor',
                status: 'last_seen',
                text: 'One defender was last seen at A.',
              },
            ],
            actions: [
              { id: 'a', label: 'Regroup toward A', qualifierIds: ['q1', 'q2'] },
              { id: 'b', label: 'Pressure middle', qualifierIds: ['q3', 'q4'] },
              { id: 'c', label: 'Hold shape', qualifierIds: ['q5', 'q6'] },
            ],
            qualifiers: [
              { id: 'q1', label: 'Quietly' },
              { id: 'q2', label: 'Immediately' },
              { id: 'q3', label: 'As a pair' },
              { id: 'q4', label: 'After a delay' },
              { id: 'q5', label: 'Passively' },
              { id: 'q6', label: 'On contact' },
            ],
            evidence: [
              { id: 'e1', label: 'Bomb location' },
              { id: 'e2', label: 'Last defender sighting' },
              { id: 'e3', label: 'Remaining utility' },
              { id: 'e4', label: 'Round clock' },
              { id: 'e5', label: 'Trade spacing' },
            ],
          },
        },
        error: null,
        meta: { request_id: crypto.randomUUID(), api_version: 'v1' },
      },
    }),
  )

  await page.goto('/')
  await page.getByRole('button', { name: 'Start case' }).click()

  await expect(page.getByRole('heading', { name: 'Read the round' })).toBeVisible()
  await expect(page.getByText('The bomb is down outside B.')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0)

  if (process.env.ROUNDCRAFT_CAPTURE_VISUALS === '1') {
    await page.screenshot({
      path: 'test-results/roundcraft-brief-desktop.png',
      fullPage: true,
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({
      path: 'test-results/roundcraft-brief-mobile.png',
      fullPage: true,
    })
  }

  await page.getByRole('button', { name: 'Choose evidence' }).click()
  await page.getByRole('checkbox', { name: 'Bomb location' }).check()
  await page.getByRole('checkbox', { name: 'Last defender sighting' }).check()

  await expect(page.getByText('2 of 2 selected')).toBeVisible()
  await expect(page.getByRole('status')).toHaveText(
    'Selection ready for the decision step',
  )
})
