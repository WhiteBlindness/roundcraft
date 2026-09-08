import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SettingsPage } from './SettingsPage'

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function validMeta() {
  return { request_id: crypto.randomUUID(), api_version: 'v1' as const }
}

describe('SettingsPage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders all three sections', () => {
    render(<SettingsPage />)

    expect(
      screen.getByRole('heading', { name: 'About Roundcraft' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'How it works' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Data management' }),
    ).toBeInTheDocument()
  })

  it('requires confirmation before deleting history', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    await user.click(
      screen.getByRole('button', { name: 'Delete history' }),
    )

    expect(
      screen.getByText('Are you sure? All data will be permanently removed.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Confirm deletion' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Cancel' }),
    ).toBeInTheDocument()
  })

  it('cancels the deletion flow and returns to idle', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    await user.click(screen.getByRole('button', { name: 'Delete history' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(
      screen.getByRole('button', { name: 'Delete history' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Are you sure?')).toBeNull()
  })

  it('shows success after confirmed deletion', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: {
            csrf_token: 'a'.repeat(43),
            identity_expires_at: '2026-11-30T12:00:00.000Z',
          },
          error: null,
          meta: validMeta(),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: { deleted: true },
          error: null,
          meta: validMeta(),
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    render(<SettingsPage />)

    await user.click(screen.getByRole('button', { name: 'Delete history' }))
    await user.click(screen.getByRole('button', { name: 'Confirm deletion' }))

    expect(
      await screen.findByText('All data has been deleted.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Start fresh' }),
    ).toBeInTheDocument()
  })

  it('shows error state and retry when deletion fails', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })),
    )

    render(<SettingsPage />)

    await user.click(screen.getByRole('button', { name: 'Delete history' }))
    await user.click(screen.getByRole('button', { name: 'Confirm deletion' }))

    expect(
      await screen.findByText(
        'The deletion could not be completed. Please try again.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Retry deletion' }),
    ).toBeInTheDocument()
  })
})
