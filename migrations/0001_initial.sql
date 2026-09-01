CREATE TABLE anonymous_identities (
  identity_id TEXT PRIMARY KEY,
  token_verifier TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'rotated', 'deleted')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  deleted_at TEXT
) STRICT;

CREATE INDEX idx_anonymous_identities_expiry
  ON anonymous_identities (expires_at, status);

CREATE TABLE cases (
  case_id TEXT PRIMARY KEY,
  origin TEXT NOT NULL CHECK (origin IN ('synthetic', 'professional')),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE case_revisions (
  case_revision TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases (case_id) ON DELETE RESTRICT,
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  checksum TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (
    status IN ('draft', 'approved', 'locked', 'corrected', 'withdrawn')
  ),
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX idx_case_revisions_case
  ON case_revisions (case_id, created_at);

CREATE TABLE editions (
  edition_id TEXT PRIMARY KEY,
  case_revision TEXT NOT NULL
    REFERENCES case_revisions (case_revision) ON DELETE RESTRICT,
  release_at TEXT NOT NULL,
  official_end_at TEXT NOT NULL,
  grace_end_at TEXT NOT NULL,
  publication_status TEXT NOT NULL CHECK (
    publication_status IN (
      'scheduled', 'released', 'corrected', 'void', 'withdrawn'
    )
  ),
  public_metadata_json TEXT NOT NULL CHECK (json_valid(public_metadata_json)),
  created_at TEXT NOT NULL,
  CHECK (release_at < official_end_at),
  CHECK (official_end_at <= grace_end_at)
) STRICT;

CREATE INDEX idx_editions_release_window
  ON editions (publication_status, release_at, official_end_at);

CREATE TABLE case_public_briefs (
  case_revision TEXT PRIMARY KEY
    REFERENCES case_revisions (case_revision) ON DELETE RESTRICT,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  checksum TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE case_followups (
  case_revision TEXT PRIMARY KEY
    REFERENCES case_revisions (case_revision) ON DELETE RESTRICT,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  checksum TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE case_reveals (
  case_revision TEXT PRIMARY KEY
    REFERENCES case_revisions (case_revision) ON DELETE RESTRICT,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  checksum TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE case_rubrics (
  rubric_revision TEXT PRIMARY KEY,
  case_revision TEXT NOT NULL UNIQUE
    REFERENCES case_revisions (case_revision) ON DELETE RESTRICT,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  checksum TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE attempts (
  attempt_id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL
    REFERENCES anonymous_identities (identity_id) ON DELETE RESTRICT,
  edition_id TEXT NOT NULL REFERENCES editions (edition_id) ON DELETE RESTRICT,
  case_revision TEXT NOT NULL
    REFERENCES case_revisions (case_revision) ON DELETE RESTRICT,
  rubric_revision TEXT NOT NULL
    REFERENCES case_rubrics (rubric_revision) ON DELETE RESTRICT,
  ruleset_revision TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('official', 'practice')),
  state TEXT NOT NULL CHECK (
    state IN (
      'issued', 'main_locked', 'decision_complete',
      'debrief_complete', 'expired_uncommitted'
    )
  ),
  sequence INTEGER NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  assisted INTEGER NOT NULL DEFAULT 0 CHECK (assisted IN (0, 1)),
  issued_at TEXT NOT NULL,
  grace_end_at TEXT NOT NULL,
  main_committed_at TEXT,
  followup_committed_at TEXT,
  debrief_completed_at TEXT,
  deletion_due_at TEXT,
  deleted_at TEXT
) STRICT;

CREATE UNIQUE INDEX idx_attempts_one_official_per_edition
  ON attempts (identity_id, edition_id)
  WHERE mode = 'official';

CREATE INDEX idx_attempts_identity_history
  ON attempts (identity_id, issued_at DESC);

CREATE INDEX idx_attempts_retention
  ON attempts (deletion_due_at, deleted_at);

CREATE TABLE attempt_commits (
  attempt_id TEXT NOT NULL REFERENCES attempts (attempt_id) ON DELETE RESTRICT,
  phase TEXT NOT NULL CHECK (phase IN ('main', 'followup')),
  answer_json TEXT NOT NULL CHECK (json_valid(answer_json)),
  request_hash TEXT NOT NULL,
  expected_sequence INTEGER NOT NULL CHECK (expected_sequence >= 0),
  accepted_sequence INTEGER NOT NULL CHECK (accepted_sequence > 0),
  accepted_at TEXT NOT NULL,
  PRIMARY KEY (attempt_id, phase)
) STRICT;

CREATE TABLE idempotency_receipts (
  attempt_id TEXT NOT NULL REFERENCES attempts (attempt_id) ON DELETE RESTRICT,
  phase TEXT NOT NULL CHECK (phase IN ('main', 'followup')),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  accepted_sequence INTEGER NOT NULL CHECK (accepted_sequence > 0),
  accepted_state TEXT NOT NULL,
  response_snapshot_json TEXT NOT NULL CHECK (json_valid(response_snapshot_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (attempt_id, phase, idempotency_key)
) STRICT;

CREATE INDEX idx_idempotency_receipts_lookup
  ON idempotency_receipts (attempt_id, phase, idempotency_key, request_hash);

CREATE TABLE result_versions (
  result_version_id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES attempts (attempt_id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL CHECK (
    status IN ('scored', 'corrected', 'recalculated', 'void')
  ),
  quality_quarter_units INTEGER NOT NULL
    CHECK (quality_quarter_units BETWEEN 0 AND 400),
  evidence_points INTEGER NOT NULL CHECK (evidence_points BETWEEN 0 AND 20),
  followup_quality INTEGER NOT NULL CHECK (followup_quality BETWEEN 0 AND 100),
  exact_total_units INTEGER NOT NULL
    CHECK (exact_total_units BETWEEN 0 AND 20000),
  total_score INTEGER NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  display_main INTEGER NOT NULL CHECK (display_main BETWEEN 0 AND 50),
  display_evidence INTEGER NOT NULL CHECK (display_evidence BETWEEN 0 AND 20),
  display_followup INTEGER NOT NULL CHECK (display_followup BETWEEN 0 AND 30),
  supersedes_result_version_id TEXT
    REFERENCES result_versions (result_version_id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  UNIQUE (attempt_id, version),
  CHECK (display_main + display_evidence + display_followup = total_score)
) STRICT;

CREATE TABLE participation_credits (
  identity_id TEXT NOT NULL
    REFERENCES anonymous_identities (identity_id) ON DELETE RESTRICT,
  edition_id TEXT NOT NULL REFERENCES editions (edition_id) ON DELETE RESTRICT,
  attempt_id TEXT NOT NULL UNIQUE
    REFERENCES attempts (attempt_id) ON DELETE RESTRICT,
  awarded_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('awarded', 'preserved', 'void')),
  PRIMARY KEY (identity_id, edition_id)
) STRICT;

CREATE TABLE fairness_reports (
  report_id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES attempts (attempt_id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (
    category IN (
      'missing_action', 'missing_qualifier', 'missing_evidence',
      'incorrect_disclosed_fact', 'other'
    )
  ),
  status TEXT NOT NULL CHECK (status IN ('open', 'reviewed', 'resolved')),
  created_at TEXT NOT NULL,
  resolved_at TEXT
) STRICT;

CREATE INDEX idx_fairness_reports_review
  ON fairness_reports (status, created_at);

CREATE TABLE analytics_events (
  event_id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  edition_id TEXT,
  mode TEXT CHECK (mode IN ('official', 'practice')),
  assisted INTEGER CHECK (assisted IN (0, 1)),
  properties_json TEXT NOT NULL CHECK (json_valid(properties_json)),
  occurred_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
) STRICT;

CREATE INDEX idx_analytics_events_retention
  ON analytics_events (expires_at);
