import { expect, test, type Page, type Response } from '@playwright/test'

// Runs against the real Worker and local D1, with no API mocking. The web
// server seeds the technical fixture `case_smoke_001` via `content:preview`.

const followupHeading = 'The round changed'
const principle =
  'When new information invalidates the route assumption, refresh the decision before committing the remaining time.'

interface CapturedResponse {
  readonly path: string
  readonly method: string
  readonly body: string
}

function captureApi(page: Page): () => Promise<CapturedResponse[]> {
  const pending: Promise<CapturedResponse | null>[] = []

  page.on('response', (response: Response) => {
    const url = new URL(response.url())
    if (!url.pathname.startsWith('/api/')) return

    pending.push(
      response
        .text()
        .then((body) => ({ path: url.pathname, method: response.request().method(), body }))
        .catch(() => null),
    )
  })

  return async () =>
    (await Promise.all(pending)).filter((item): item is CapturedResponse => item !== null)
}

async function waitForApi(page: Page, suffix: string, method = 'POST') {
  return page.waitForResponse(
    (response) =>
      response.url().endsWith(suffix) && response.request().method() === method,
  )
}

test('an anonymous player completes one official case end to end', async ({ page }) => {
  page.on('dialog', (dialog) => void dialog.accept())
  const apiResponses = captureApi(page)

  await page.goto('/')
  await expect(page.getByRole('heading', { name: "Today's tactical case" })).toBeVisible()
  await page.getByRole('button', { name: 'Start case' }).click()

  await expect(page.getByRole('heading', { name: 'Read the round' })).toBeFocused()
  await expect(page.getByRole('heading', { name: 'The last smoke' })).toBeVisible()

  await page.getByRole('button', { name: 'Choose evidence' }).click()
  await page.getByRole('checkbox', { name: 'Bomb location' }).check()
  await page.getByRole('checkbox', { name: 'Last defender sighting' }).check()
  await page.getByRole('button', { name: 'Continue to call' }).click()
  await page.getByRole('radio', { name: 'Regroup toward A' }).check()
  await page.getByRole('radio', { name: 'Quietly' }).check()
  await page.getByRole('radio', { name: 'Fairly sure' }).check()
  await page.getByRole('button', { name: 'Review call' }).click()
  await expect(page.getByRole('heading', { name: 'Review your line' })).toBeFocused()

  // Enter on a focused button keeps its native meaning; it must never lock the call.
  await page.getByRole('button', { name: 'Edit call' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Make the call' })).toBeFocused()
  await page.getByRole('button', { name: 'Review call' }).click()

  // Phase-gated disclosure: nothing received so far may contain follow-up or reveal content.
  const beforeLock = await apiResponses()
  expect(beforeLock.some((response) => response.path === '/api/v1/attempts')).toBe(true)
  for (const response of beforeLock) {
    expect(response.body, response.path).not.toContain(followupHeading)
    expect(response.body, response.path).not.toContain(principle)
    expect(response.body, response.path).not.toContain('rubricRevision')
  }

  const mainCommitPromise = waitForApi(page, '/main-commit')
  await page.getByRole('button', { name: 'Lock main call' }).click()
  const mainCommit = await mainCommitPromise
  expect(mainCommit.status()).toBe(200)
  await expect(page.getByRole('heading', { name: followupHeading })).toBeFocused()

  for (const response of await apiResponses()) {
    expect(response.body, response.path).not.toContain(principle)
  }

  // The server rejects a second, different main commitment for the locked attempt.
  const lockedAttemptId = new URL(mainCommit.url()).pathname.split('/')[4] ?? ''
  expect(lockedAttemptId).toHaveLength(43)

  const replayStatus = await page.evaluate(async (id) => {
    const session = await fetch('/api/v1/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    const { data } = (await session.json()) as { data: { csrf_token: string } }
    const response = await fetch(`/api/v1/attempts/${id}/main-commit`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': crypto.randomUUID(),
        'if-match': '"0"',
        'x-csrf-token': data.csrf_token,
      },
      body: JSON.stringify({
        case_revision: 'case_revision_smoke_001',
        action_id: 'c',
        qualifier_id: 'q5',
        evidence_ids: ['e1', 'e2'],
        confidence_id: 'guessing',
      }),
    })
    return response.status
  }, lockedAttemptId)
  expect(replayStatus).toBe(409)

  // Refresh after the irreversible lock: the attempt resumes at the follow-up.
  await page.reload()
  await page.getByRole('button', { name: 'Continue case' }).click()
  await expect(page.getByRole('heading', { name: followupHeading })).toBeVisible()

  await page.getByRole('radio', { name: 'Change to pressure middle' }).check()
  await page.getByRole('button', { name: 'Review update' }).click()
  const followupCommit = waitForApi(page, '/followup-commit')
  await page.getByRole('button', { name: 'Lock follow-up' }).click()
  expect((await followupCommit).status()).toBe(200)

  await expect(
    page.getByRole('heading', { name: 'What actually happened', level: 1 }),
  ).toBeFocused()
  await expect(page.getByRole('heading', { name: 'What to remember from this round' })).toBeVisible()
  await expect(page.getByText(principle)).toBeVisible()
  await expect(page.getByText('Evidence: Bomb location · Last defender sighting')).toBeVisible()

  const total = (await page.locator('.total-score').innerText()).replace(/\s+/g, '')
  expect(total).toMatch(/^\d{1,3}\/100$/)
  const components = await page.locator('.score-components dd').allInnerTexts()
  const points = components.map((text) => Number(text.split('/')[0]))
  expect(points.reduce((sum, value) => sum + value, 0)).toBe(Number(total.split('/')[0]))

  // Refresh at the debrief: the stored result is returned unchanged.
  await page.reload()
  await page.getByRole('button', { name: /Review result|View debrief|Continue case/ }).click()
  await expect(page.locator('.total-score')).toHaveText(new RegExp(total.replace('/', '\\s*/\\s*')))

  const completion = waitForApi(page, '/debrief-complete')
  await page.getByRole('button', { name: 'Finish review' }).click()
  expect((await completion).status()).toBe(200)
  await expect(page.getByText('Review complete')).toBeVisible()
})

test('the shortcuts panel is a modal dialog that restores focus', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start case' }).click()
  await expect(page.getByRole('heading', { name: 'Read the round' })).toBeFocused()

  const trigger = page.getByRole('button', { name: 'Keyboard shortcuts' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Close keyboard shortcuts' })).toBeFocused()

  // Enter inside the dialog must not advance the stage behind it.
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Read the round' })).toBeVisible()
  await expect(trigger).toBeFocused()
})
