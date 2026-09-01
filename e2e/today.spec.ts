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
            confidence: [
              { id: 'guessing', label: 'Guessing' },
              { id: 'leaning', label: 'Leaning' },
              { id: 'fairly_sure', label: 'Fairly sure' },
              { id: 'strong_read', label: 'Strong read' },
            ],
          },
        },
        error: null,
        meta: { request_id: crypto.randomUUID(), api_version: 'v1' },
      },
    }),
  )
  await page.route('**/api/v1/attempts/*/main-commit', (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          attempt: {
            attempt_id: 'b'.repeat(43),
            state: 'main_locked',
            sequence: 1,
            main_committed_at: '2026-09-01T14:48:00.000Z',
          },
          main_answer: {
            action_id: 'a',
            qualifier_id: 'q1',
            evidence_ids: ['e1', 'e2'],
            confidence_id: 'fairly_sure',
          },
          followup: {
            schemaVersion: 1,
            caseRevision: 'case_revision_001',
            type: 'new_information',
            heading: 'The round changed',
            stimulus: 'Eight seconds pass before a defender is heard rotating.',
            updates: [
              {
                id: 'rotation',
                status: 'new',
                text: 'A defender is heard leaving B.',
              },
            ],
            responses: [
              { id: 'keep_original', label: 'Keep the original line' },
              { id: 'change_mid', label: 'Change to pressure middle' },
            ],
          },
        },
        error: null,
        meta: { request_id: crypto.randomUUID(), api_version: 'v1' },
      },
    }),
  )
  await page.route('**/api/v1/attempts/*/followup-commit', (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          attempt: {
            attempt_id: 'b'.repeat(43),
            state: 'decision_complete',
            sequence: 2,
            followup_committed_at: '2026-09-01T14:49:00.000Z',
          },
          main_answer: {
            action_id: 'a',
            qualifier_id: 'q1',
            evidence_ids: ['e1', 'e2'],
            confidence_id: 'fairly_sure',
          },
          followup_answer: {
            case_revision: 'case_revision_001',
            type: 'new_information',
            response_id: 'change_mid',
          },
          result: {
            version: 1,
            total: 89,
            components: { main: 45, evidence: 16, followup: 28 },
            main_band: 'Best-supported',
            followup_band: 'Best-supported',
            confidence_id: 'fairly_sure',
            mode: 'official',
            assisted: false,
            participation: 'awarded',
          },
          reveal: {
            schemaVersion: 1,
            caseRevision: 'case_revision_001',
            continuation: {
              kind: 'authored',
              events: [
                {
                  timestamp: '00:23',
                  action: 'The pair re-cleared middle.',
                  consequence: 'The rotation was confirmed before commitment.',
                  state: 'The round ended with a supported A split.',
                },
              ],
            },
            comparison: {
              roundAction: 'Re-clear middle before committing.',
              materialInformation: 'The aged sighting and rotation sound.',
              roundFollowup: 'The authored line changed after the cue.',
            },
            debrief: {
              whyItWorks: 'It refreshes the oldest decisive information.',
              cost: 'It spends time and gives up immediate pressure.',
              assumption: 'The pair can trade the re-clear.',
              breaksWhen: 'The clock no longer permits a second route.',
              evidenceReview: [
                { evidenceId: 'e1', explanation: 'The bomb preserved both routes.' },
                { evidenceId: 'e2', explanation: 'The sighting had aged.' },
              ],
              followupReview: 'Changing line responded to the new information.',
              strongestAlternative: 'Keep the line, but accelerate.',
              counterfactual: {
                changedFact: 'Remove the rotation sound.',
                effect: 'Keeping the original line becomes equally strong.',
              },
              method: 'Synthetic case reviewed against disclosed state only.',
              sources: [
                { label: 'Roundcraft method', detail: 'Synthetic continuation.' },
              ],
            },
            principle:
              'When new information invalidates the route assumption, refresh the decision before committing the remaining time.',
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
  await page.getByRole('button', { name: 'Continue to call' }).click()
  await page.getByRole('radio', { name: 'Regroup toward A' }).check()
  await page.getByRole('radio', { name: 'Quietly' }).check()
  await page.getByRole('radio', { name: 'Fairly sure' }).check()
  await page.getByRole('button', { name: 'Review call' }).click()
  await expect(page.getByRole('heading', { name: 'Review your line' })).toBeVisible()
  await page.getByRole('button', { name: 'Lock main call' }).click()
  await expect(page.getByRole('heading', { name: 'The round changed' })).toBeFocused()
  await expect(page.getByText('Main locked')).toBeVisible()

  if (process.env.ROUNDCRAFT_CAPTURE_VISUALS === '1') {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.screenshot({
      path: 'test-results/roundcraft-followup-desktop.png',
      fullPage: true,
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({
      path: 'test-results/roundcraft-followup-mobile.png',
      fullPage: true,
    })
  }

  await page.getByRole('radio', { name: 'Change to pressure middle' }).check()
  await page.getByRole('button', { name: 'Review update' }).click()
  await expect(page.getByRole('heading', { name: 'Review your update' })).toBeFocused()
  await page.getByRole('button', { name: 'Lock follow-up' }).click()
  await expect(
    page.getByRole('heading', { name: 'What actually happened', level: 1 }),
  ).toBeFocused()
  await expect(page.locator('.total-score')).toContainText('89/100')
  await expect(page.getByText('Awarded')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'What to remember from this round' }),
  ).toBeVisible()

  if (process.env.ROUNDCRAFT_CAPTURE_VISUALS === '1') {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.screenshot({
      path: 'test-results/roundcraft-debrief-desktop.png',
      fullPage: true,
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({
      path: 'test-results/roundcraft-debrief-mobile.png',
      fullPage: true,
    })
  }
})
