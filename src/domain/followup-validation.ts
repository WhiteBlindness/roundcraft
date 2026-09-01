import type { FollowupAnswer } from './followup-answer'
import type { PublicFollowup } from './public-followup'

export function isPublishedFollowupAnswer(
  answer: FollowupAnswer,
  followup: PublicFollowup,
): boolean {
  if (
    answer.case_revision !== followup.caseRevision ||
    answer.type !== followup.type
  ) {
    return false
  }

  if (answer.type === 'new_information' && followup.type === 'new_information') {
    return followup.responses.some(({ id }) => id === answer.response_id)
  }

  if (answer.type === 'economy_risk' && followup.type === 'economy_risk') {
    return (
      followup.postures.some(({ id }) => id === answer.posture_id) &&
      followup.priorities.some(({ id }) => id === answer.priority_id)
    )
  }

  return false
}
