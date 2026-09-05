-- Seed data for local development only.
-- Run after migrations; dates use a wide window so the edition stays current.

INSERT OR IGNORE INTO cases (case_id, origin, created_at)
VALUES ('case_smoke_001', 'synthetic', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO case_revisions (
  case_revision, case_id, schema_version, checksum, status, created_at
) VALUES (
  'case_revision_smoke_001', 'case_smoke_001', 1,
  'seed_checksum_001', 'approved', '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO editions (
  edition_id, case_revision, release_at, official_end_at, grace_end_at,
  publication_status, public_metadata_json, created_at
) VALUES (
  'edition_smoke_001',
  'case_revision_smoke_001',
  '2026-01-01T00:00:00.000Z',
  '2027-12-31T23:59:59.000Z',
  '2028-01-01T23:59:59.000Z',
  'released',
  '{"case_number":1,"edition_date_utc":"2026-09-05","estimated_minutes":7,"focus":"Resource allocation under uncertainty","origin_label":"Synthetic scenario — editorial tactical analysis."}',
  '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO case_public_briefs (
  case_revision, payload_json, checksum, created_at
) VALUES (
  'case_revision_smoke_001',
  '{
    "schemaVersion": 1,
    "editionId": "edition_smoke_001",
    "caseRevision": "case_revision_smoke_001",
    "title": "The last smoke",
    "focus": "Resource allocation under uncertainty",
    "origin": "synthetic",
    "facts": [
      {"id": "bomb", "status": "confirmed", "text": "The bomb is down outside B."},
      {"id": "anchor", "status": "last_seen", "text": "One defender was last seen at A."}
    ],
    "actions": [
      {"id": "a", "label": "Regroup toward A", "qualifierIds": ["q1", "q2"]},
      {"id": "b", "label": "Pressure middle", "qualifierIds": ["q3", "q4"]},
      {"id": "c", "label": "Hold shape", "qualifierIds": ["q5", "q6"]}
    ],
    "qualifiers": [
      {"id": "q1", "label": "Quietly"},
      {"id": "q2", "label": "Immediately"},
      {"id": "q3", "label": "As a pair"},
      {"id": "q4", "label": "After a delay"},
      {"id": "q5", "label": "Passively"},
      {"id": "q6", "label": "On contact"}
    ],
    "evidence": [
      {"id": "e1", "label": "Bomb location"},
      {"id": "e2", "label": "Last defender sighting"},
      {"id": "e3", "label": "Remaining utility"},
      {"id": "e4", "label": "Round clock"},
      {"id": "e5", "label": "Trade spacing"}
    ],
    "confidence": [
      {"id": "guessing", "label": "Guessing"},
      {"id": "leaning", "label": "Leaning"},
      {"id": "fairly_sure", "label": "Fairly sure"},
      {"id": "strong_read", "label": "Strong read"}
    ]
  }',
  'seed_brief_checksum_001',
  '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO case_followups (
  case_revision, payload_json, checksum, created_at
) VALUES (
  'case_revision_smoke_001',
  '{
    "schemaVersion": 1,
    "caseRevision": "case_revision_smoke_001",
    "type": "new_information",
    "heading": "The round changed",
    "stimulus": "Eight seconds pass before a defender is heard rotating.",
    "updates": [
      {"id": "rotation", "status": "new", "text": "A defender is heard leaving B."}
    ],
    "responses": [
      {"id": "keep_original", "label": "Keep the original line"},
      {"id": "change_mid", "label": "Change to pressure middle"}
    ]
  }',
  'seed_followup_checksum_001',
  '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO case_reveals (
  case_revision, payload_json, checksum, created_at
) VALUES (
  'case_revision_smoke_001',
  '{
    "schemaVersion": 1,
    "caseRevision": "case_revision_smoke_001",
    "continuation": {
      "kind": "authored",
      "events": [
        {
          "timestamp": "00:23",
          "action": "The pair re-cleared middle.",
          "consequence": "The rotation was confirmed.",
          "state": "The round ended with a supported A split."
        }
      ]
    },
    "comparison": {
      "roundAction": "Re-clear middle before committing.",
      "materialInformation": "The new rotation sound.",
      "roundFollowup": "The authored line changed after the cue."
    },
    "debrief": {
      "whyItWorks": "It refreshes the oldest decisive information.",
      "cost": "It spends time.",
      "assumption": "The pair can trade.",
      "breaksWhen": "The clock no longer permits a second route.",
      "evidenceReview": [
        {"evidenceId": "e1", "explanation": "The bomb preserved both routes."},
        {"evidenceId": "e2", "explanation": "The sighting had aged."}
      ],
      "followupReview": "The change responded to the new information.",
      "strongestAlternative": "Keep the line, but accelerate.",
      "counterfactual": {
        "changedFact": "Remove the sound cue.",
        "effect": "Keeping the line becomes equally strong."
      },
      "method": "Synthetic case reviewed against disclosed state only.",
      "sources": [
        {"label": "Roundcraft method", "detail": "Synthetic continuation."}
      ]
    },
    "principle": "When new information invalidates the route assumption, refresh the decision before committing the remaining time."
  }',
  'seed_reveal_checksum_001',
  '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO case_rubrics (
  rubric_revision, case_revision, payload_json, checksum, created_at
) VALUES (
  'rubric_smoke_001',
  'case_revision_smoke_001',
  '{"SERVER_ONLY": true, "schemaVersion": 1, "caseRevision": "case_revision_smoke_001", "mainBands": [{"bandId": "best_supported", "label": "Best-supported", "qualityFloor": 80, "qualityCeiling": 100, "actions": [{"actionId": "a", "qualifierGroups": [{"qualifierIds": ["q1"], "quality": 100}, {"qualifierIds": ["q2"], "quality": 80}]}]}, {"bandId": "reasonable", "label": "Reasonable", "qualityFloor": 50, "qualityCeiling": 79, "actions": [{"actionId": "b", "qualifierGroups": [{"qualifierIds": ["q3"], "quality": 70}, {"qualifierIds": ["q4"], "quality": 50}]}]}, {"bandId": "weak", "label": "Weak", "qualityFloor": 10, "qualityCeiling": 49, "actions": [{"actionId": "c", "qualifierGroups": [{"qualifierIds": ["q5"], "quality": 40}, {"qualifierIds": ["q6"], "quality": 10}]}]}], "evidenceWeights": [{"evidenceId": "e1", "weight": 10}, {"evidenceId": "e2", "weight": 10}, {"evidenceId": "e3", "weight": 5}, {"evidenceId": "e4", "weight": 5}, {"evidenceId": "e5", "weight": 3}], "followupBands": [{"responseId": "change_mid", "bandId": "best_supported", "label": "Best-supported", "quality": 100}, {"responseId": "keep_original", "bandId": "reasonable", "label": "Reasonable", "quality": 60}]}',
  'seed_rubric_checksum_001',
  '2026-01-01T00:00:00.000Z'
);
