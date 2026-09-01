import { expect, test } from '@playwright/test'

test('Today exposes only the cover before a case starts', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Today’s tactical case' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start case' })).toBeEnabled()
  await expect(page.getByText('Decisive evidence')).toHaveCount(0)
})
