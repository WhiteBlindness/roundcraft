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
