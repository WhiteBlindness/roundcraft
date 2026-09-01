export type AttemptState =
  | 'issued'
  | 'main_locked'
  | 'decision_complete'
  | 'debrief_complete'

export type AttemptEvent =
  | 'commit_main'
  | 'commit_followup'
  | 'complete_debrief'

export interface AttemptSnapshot {
  readonly state: AttemptState
  readonly sequence: number
}

const transitions: Readonly<
  Record<AttemptState, Readonly<Partial<Record<AttemptEvent, AttemptState>>>>
> = {
  issued: { commit_main: 'main_locked' },
  main_locked: { commit_followup: 'decision_complete' },
  decision_complete: { complete_debrief: 'debrief_complete' },
  debrief_complete: {},
}

export class TransitionError extends Error {
  readonly code = 'ATTEMPT_STATE_CONFLICT'

  constructor(state: AttemptState, event: AttemptEvent) {
    super(`ATTEMPT_STATE_CONFLICT: ${event} is not valid from ${state}`)
    this.name = 'TransitionError'
  }
}

export function transitionAttempt(
  attempt: AttemptSnapshot,
  event: AttemptEvent,
): AttemptSnapshot {
  if (!Number.isSafeInteger(attempt.sequence) || attempt.sequence < 0) {
    throw new Error('Invalid attempt sequence')
  }

  const nextState = transitions[attempt.state][event]

  if (!nextState) {
    throw new TransitionError(attempt.state, event)
  }

  return {
    state: nextState,
    sequence: attempt.sequence + 1,
  }
}
