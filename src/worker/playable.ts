/**
 * The single definition of when a case revision may be played.
 *
 * A revision is playable only when its `case_revisions.status` is 'locked'
 * AND its edition's `publication_status` is 'released', within the release
 * window the caller applies with bound parameters (`release_at <= ?`, and for
 * official play `official_end_at > ?`). Every query that advertises or starts
 * an edition (/today, /cases, POST /attempts, POST /practice-attempts) must
 * embed this fragment so the routes cannot disagree.
 *
 * The fragment assumes the aliases `e` (editions) and `cr` (case_revisions).
 * Reading or committing an EXISTING attempt intentionally checks only
 * `publication_status = 'released'` so resuming keeps working.
 */
export const playableRevisionSql = `e.publication_status = 'released' AND cr.status = 'locked'`
