import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('App', () => {
  it('renders the Today cover without exposing the case briefing', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Today’s tactical case' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Synthetic scenario — editorial tactical analysis.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start case' })).toBeEnabled()
    expect(screen.queryByText('Decisive evidence')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start case' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      'The case service will be connected in the next implementation slice.',
    )
  })
})
