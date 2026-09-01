import { describe, expect, it } from 'vitest'

import { transitionAttempt, TransitionError } from './attempt-machine'

describe('transitionAttempt', () => {
  it('moves monotonically through the official states', () => {
    const mainLocked = transitionAttempt(
      { state: 'issued', sequence: 0 },
      'commit_main',
    )
    const decisionComplete = transitionAttempt(mainLocked, 'commit_followup')
    const debriefComplete = transitionAttempt(
      decisionComplete,
      'complete_debrief',
    )

    expect(mainLocked).toEqual({ state: 'main_locked', sequence: 1 })
    expect(decisionComplete).toEqual({
      state: 'decision_complete',
      sequence: 2,
    })
    expect(debriefComplete).toEqual({
      state: 'debrief_complete',
      sequence: 3,
    })
  })

  it('rejects a follow-up before the main commitment', () => {
    expect(() =>
      transitionAttempt({ state: 'issued', sequence: 0 }, 'commit_followup'),
    ).toThrow(TransitionError)
  })

  it('never reopens a completed decision', () => {
    expect(() =>
      transitionAttempt(
        { state: 'decision_complete', sequence: 2 },
        'commit_main',
      ),
    ).toThrow('ATTEMPT_STATE_CONFLICT')
  })
})
