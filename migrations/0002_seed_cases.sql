-- Seed migration: three cases based on real CS2 professional tactical scenarios.
--
-- Sources:
--   Case 1 – Inferno banana control & B-site execute:
--     bo3.gg  "CS2 Inferno Banana Guide: Control & Execute Tips"
--     esportsrambles.com  "CS2: Smokes Guide - Basic smokes to know on Inferno"
--     cs2pulse.com  "Banana Control on Inferno after Update and Changes as CT"
--   Case 2 – Mirage A-site split with coordinated smokes:
--     blast.tv  "CS2 mirage smokes"
--     cs2pulse.com  "CS2 Mirage Smokes Guide"
--     dignitas.gg  "Default Strategies on T-side: Virtus.Pro on de_mirage"
--   Case 3 – Post-pistol economy decision:
--     scope.gg  "How does the economy work in CS:GO? Guide by SCOPE.GG"
--     csmarketcap.com  "CS Economy Guide"
--     matchupworld.com  "CS2 Economy, Loss Bonus and Force Buys Explained"

-- ═══════════════════════════════════════════════════════════════════
-- CASE 1 — Inferno: Banana control into B-site execute
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO cases (case_id, origin, created_at)
VALUES ('case_inferno_banana_001', 'professional', '2024-06-01T00:00:00Z');

INSERT INTO case_revisions (case_revision, case_id, schema_version, checksum, status, created_at)
VALUES (
  'cr_inferno_banana_001',
  'case_inferno_banana_001',
  1,
  'sha256:inferno_banana_001_rev1',
  'approved',
  '2024-06-01T00:00:00Z'
);

INSERT INTO case_public_briefs (case_revision, payload_json, checksum, created_at)
VALUES (
  'cr_inferno_banana_001',
  json('{
    "schemaVersion": 1,
    "editionId": "ed_inferno_banana_001",
    "caseRevision": "cr_inferno_banana_001",
    "title": "Banana pressure",
    "focus": "Map control and utility management on Inferno",
    "origin": "professional",
    "facts": [
      {"id": "banana_control", "status": "confirmed", "text": "Your team holds banana after an early molotov and HE grenade forced the CTs back to site."},
      {"id": "ct_smoke_used", "status": "confirmed", "text": "The CT anchor used one smoke to delay the push — it has now faded."},
      {"id": "second_player", "status": "last_seen", "text": "A second CT was last seen rotating from A through CT spawn thirty seconds ago."},
      {"id": "utility_count", "status": "confirmed", "text": "Your entry pair has one smoke and two flashes remaining."},
      {"id": "clock", "status": "confirmed", "text": "Forty-five seconds remain in the round."}
    ],
    "actions": [
      {"id": "execute_b", "label": "Execute onto B site", "qualifierIds": ["smoke_ct", "fast_no_smoke"]},
      {"id": "fake_b_rotate_a", "label": "Fake B and rotate to A", "qualifierIds": ["full_utility_fake", "quiet_rotate"]},
      {"id": "hold_banana", "label": "Hold banana and wait for information", "qualifierIds": ["passive_hold", "aggressive_peek"]}
    ],
    "qualifiers": [
      {"id": "smoke_ct", "label": "Smoking CT spawn to cut the rotation"},
      {"id": "fast_no_smoke", "label": "Rushing without smoking CT"},
      {"id": "full_utility_fake", "label": "Burning all remaining utility on the fake"},
      {"id": "quiet_rotate", "label": "Rotating silently through mid"},
      {"id": "passive_hold", "label": "Holding the angle without peeking"},
      {"id": "aggressive_peek", "label": "Peeking for an early pick"}
    ],
    "evidence": [
      {"id": "banana_control_ev", "label": "Banana control status"},
      {"id": "ct_utility_spent", "label": "CT utility already spent"},
      {"id": "rotation_timing", "label": "Time since last rotation sound"},
      {"id": "remaining_clock", "label": "Round clock"},
      {"id": "own_utility", "label": "Own remaining utility"}
    ],
    "confidence": [
      {"id": "guessing", "label": "Guessing"},
      {"id": "leaning", "label": "Leaning"},
      {"id": "fairly_sure", "label": "Fairly sure"},
      {"id": "strong_read", "label": "Strong read"}
    ]
  }'),
  'sha256:inferno_banana_brief_001',
  '2024-06-01T00:00:00Z'
);

INSERT INTO case_followups (case_revision, payload_json, checksum, created_at)
VALUES (
  'cr_inferno_banana_001',
  json('{
    "schemaVersion": 1,
    "caseRevision": "cr_inferno_banana_001",
    "type": "new_information",
    "heading": "New sound cue",
    "stimulus": "A step sound is heard near coffins — the second CT has arrived at B site.",
    "updates": [
      {"id": "ct_arrived", "status": "new", "text": "A second defender has been heard at coffins on B site."}
    ],
    "responses": [
      {"id": "proceed_execute", "label": "Continue the B execute with the smoke"},
      {"id": "split_entry", "label": "Split the entry — one player through construction, one through banana"},
      {"id": "abort_rotate", "label": "Abort and rotate to A immediately"}
    ]
  }'),
  'sha256:inferno_banana_followup_001',
  '2024-06-01T00:00:00Z'
);

INSERT INTO case_reveals (case_revision, payload_json, checksum, created_at)
VALUES (
  'cr_inferno_banana_001',
  json('{
    "schemaVersion": 1,
    "caseRevision": "cr_inferno_banana_001",
    "continuation": {
      "kind": "authored",
      "events": [
        {"timestamp": "01:15", "action": "The entry pair smoked CT spawn and split through banana and construction.", "consequence": "The double entry caught the second CT still repositioning after arriving at coffins.", "state": "Both CTs were eliminated. The bomb was planted with twenty-eight seconds remaining."}
      ]
    },
    "comparison": {
      "roundAction": "Split entry onto B site with the CT smoke.",
      "materialInformation": "The sound cue confirming the second CT had arrived at coffins — still repositioning, not yet set up.",
      "roundFollowup": "Splitting the entry exploited the brief window before both CTs were anchored."
    },
    "debrief": {
      "whyItWorks": "The CT rotation sound revealed that the second defender had only just arrived and was not yet positioned. A split entry from two angles catches an unset defence.",
      "cost": "Splitting the team reduces trade potential if the first entry dies before the second arrives.",
      "assumption": "The CT heard at coffins has not yet reached a strong post-plant position.",
      "breaksWhen": "If the CT arrived early and is already set up at headshot or dark, the split loses its timing advantage.",
      "evidenceReview": [
        {"evidenceId": "ct_utility_spent", "explanation": "The CT anchor had already used their smoke, leaving no fast way to delay the execute."},
        {"evidenceId": "rotation_timing", "explanation": "The rotation sound was recent, meaning the second CT was still moving into position — a narrow timing window."}
      ],
      "followupReview": "Splitting the entry was the strongest response because it attacked the moment of vulnerability — the period between the second CT arriving and settling into an anchored position.",
      "strongestAlternative": "Proceeding with a standard execute through banana alone. Simpler, maintains trade spacing, but gives both CTs time to cross-fire from set positions.",
      "counterfactual": {"changedFact": "If the second CT had arrived thirty seconds earlier and was already set up at headshot.", "effect": "A split would walk into a prepared cross-fire. The standard banana execute with a CT smoke would then be safer because it removes the cross-fire angle."},
      "method": "Scenario constructed from documented professional Inferno banana control tactics and CT rotation patterns.",
      "sources": [
        {"label": "bo3.gg", "detail": "CS2 Inferno Banana Guide: Control & Execute Tips"},
        {"label": "cs2pulse.com", "detail": "Banana Control on Inferno after Update and Changes as CT"},
        {"label": "esportsrambles.com", "detail": "CS2: Smokes Guide - Basic smokes to know on Inferno"}
      ]
    },
    "principle": "When a sound cue reveals that a rotating defender is still repositioning, exploit the timing gap before the defence sets — but only if your utility can remove one angle of the cross-fire."
  }'),
  'sha256:inferno_banana_reveal_001',
  '2024-06-01T00:00:00Z'
);

INSERT INTO case_rubrics (rubric_revision, case_revision, payload_json, checksum, created_at)
VALUES (
  'rr_inferno_banana_001',
  'cr_inferno_banana_001',
  json('{
    "schemaVersion": 1,
    "caseRevision": "cr_inferno_banana_001",
    "rubricRevision": "rr_inferno_banana_001",
    "dimensions": [
      {"id": "timing", "weight": 55},
      {"id": "utility_use", "weight": 45}
    ],
    "main": [
      {"actionId": "execute_b", "qualifierId": "smoke_ct", "ratings": {"timing": 4, "utility_use": 4}, "caps": []},
      {"actionId": "execute_b", "qualifierId": "fast_no_smoke", "ratings": {"timing": 3, "utility_use": 1}, "caps": []},
      {"actionId": "fake_b_rotate_a", "qualifierId": "full_utility_fake", "ratings": {"timing": 2, "utility_use": 2}, "caps": []},
      {"actionId": "fake_b_rotate_a", "qualifierId": "quiet_rotate", "ratings": {"timing": 1, "utility_use": 3}, "caps": []},
      {"actionId": "hold_banana", "qualifierId": "passive_hold", "ratings": {"timing": 1, "utility_use": 2}, "caps": []},
      {"actionId": "hold_banana", "qualifierId": "aggressive_peek", "ratings": {"timing": 2, "utility_use": 1}, "caps": []}
    ],
    "evidence": [
      {"actionId": "execute_b", "evidenceIds": ["ct_utility_spent", "rotation_timing"], "points": 18},
      {"actionId": "execute_b", "evidenceIds": ["banana_control_ev", "ct_utility_spent"], "points": 14},
      {"actionId": "execute_b", "evidenceIds": ["remaining_clock", "own_utility"], "points": 12},
      {"actionId": "fake_b_rotate_a", "evidenceIds": ["remaining_clock", "rotation_timing"], "points": 10},
      {"actionId": "hold_banana", "evidenceIds": ["remaining_clock", "rotation_timing"], "points": 6}
    ],
    "followup": {
      "type": "new_information",
      "responses": [
        {"responseId": "proceed_execute", "quality": 65},
        {"responseId": "split_entry", "quality": 92},
        {"responseId": "abort_rotate", "quality": 30}
      ]
    }
  }'),
  'sha256:inferno_banana_rubric_001',
  '2024-06-01T00:00:00Z'
);

INSERT INTO editions (
  edition_id, case_revision, release_at, official_end_at, grace_end_at,
  publication_status, public_metadata_json, created_at
) VALUES (
  'ed_inferno_banana_001',
  'cr_inferno_banana_001',
  '2024-06-01T06:00:00Z',
  '2030-12-31T23:59:59Z',
  '2031-01-01T05:59:59Z',
  'released',
  json('{"case_number": 1, "edition_date_utc": "2024-06-01", "estimated_minutes": 6, "focus": "Map control and utility management", "origin_label": "Based on professional Inferno banana control tactics"}'),
  '2024-06-01T00:00:00Z'
);


-- ═══════════════════════════════════════════════════════════════════
-- CASE 2 — Mirage: Coordinated A-site split with smokes
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO cases (case_id, origin, created_at)
VALUES ('case_mirage_a_split_001', 'professional', '2024-06-02T00:00:00Z');

INSERT INTO case_revisions (case_revision, case_id, schema_version, checksum, status, created_at)
VALUES (
  'cr_mirage_a_split_001',
  'case_mirage_a_split_001',
  1,
  'sha256:mirage_a_split_001_rev1',
  'approved',
  '2024-06-02T00:00:00Z'
);

INSERT INTO case_public_briefs (case_revision, payload_json, checksum, created_at)
VALUES (
  'cr_mirage_a_split_001',
  json('{
    "schemaVersion": 1,
    "editionId": "ed_mirage_a_split_001",
    "caseRevision": "cr_mirage_a_split_001",
    "title": "The A split",
    "focus": "Coordinated site execution on Mirage",
    "origin": "professional",
    "facts": [
      {"id": "mid_control", "status": "confirmed", "text": "Your team controls top mid after smoking window from T spawn."},
      {"id": "connector_clear", "status": "confirmed", "text": "A teammate cleared connector with a flash and holds it."},
      {"id": "awp_spotted", "status": "last_seen", "text": "An AWP was spotted at ticket booth ten seconds ago."},
      {"id": "utility_available", "status": "confirmed", "text": "Three smokes and four flashes remain across the team."},
      {"id": "ct_count", "status": "inferred", "text": "At least two CTs are on the A side — one stairs, one site."},
      {"id": "round_time", "status": "confirmed", "text": "One minute and five seconds remain in the round."}
    ],
    "actions": [
      {"id": "full_a_execute", "label": "Full A execute with three smokes", "qualifierIds": ["smoke_stairs_jungle_ct", "smoke_stairs_jungle_only"]},
      {"id": "split_a_through_connector", "label": "Split A through connector and ramp", "qualifierIds": ["connector_first", "ramp_first"]},
      {"id": "default_mid", "label": "Continue the default from mid control", "qualifierIds": ["slow_info", "fast_underpass"]}
    ],
    "qualifiers": [
      {"id": "smoke_stairs_jungle_ct", "label": "Smoking stairs, jungle, and CT to isolate the site"},
      {"id": "smoke_stairs_jungle_only", "label": "Smoking stairs and jungle only, saving one smoke"},
      {"id": "connector_first", "label": "Leading the entry from connector"},
      {"id": "ramp_first", "label": "Leading the entry from ramp with a flash"},
      {"id": "slow_info", "label": "Playing slowly for more information"},
      {"id": "fast_underpass", "label": "Sending a player through underpass for a flank"}
    ],
    "evidence": [
      {"id": "mid_control_ev", "label": "Top mid control"},
      {"id": "awp_position", "label": "AWP last known position"},
      {"id": "connector_hold", "label": "Connector presence"},
      {"id": "utility_count", "label": "Remaining team utility"},
      {"id": "ct_positions", "label": "Inferred CT positions"},
      {"id": "time_remaining", "label": "Round clock"}
    ],
    "confidence": [
      {"id": "guessing", "label": "Guessing"},
      {"id": "leaning", "label": "Leaning"},
      {"id": "fairly_sure", "label": "Fairly sure"},
      {"id": "strong_read", "label": "Strong read"}
    ]
  }'),
  'sha256:mirage_a_split_brief_001',
  '2024-06-02T00:00:00Z'
);

INSERT INTO case_followups (case_revision, payload_json, checksum, created_at)
VALUES (
  'cr_mirage_a_split_001',
  json('{
    "schemaVersion": 1,
    "caseRevision": "cr_mirage_a_split_001",
    "type": "new_information",
    "heading": "Window smoke fading",
    "stimulus": "The window smoke has faded. The AWPer is now visible holding from ticket booth, watching top mid.",
    "updates": [
      {"id": "awp_confirmed", "status": "new", "text": "The AWPer is confirmed at ticket booth, scoped toward top mid."},
      {"id": "window_open", "status": "new", "text": "Window is now open — no smoke cover for mid crossing."}
    ],
    "responses": [
      {"id": "resmoke_window", "label": "Re-smoke window and proceed with the original plan"},
      {"id": "rush_now", "label": "Execute immediately before the AWP repositions"},
      {"id": "abandon_mid", "label": "Abandon mid control and rotate toward B"}
    ]
  }'),
  'sha256:mirage_a_split_followup_001',
  '2024-06-02T00:00:00Z'
);

INSERT INTO case_reveals (case_revision, payload_json, checksum, created_at)
VALUES (
  'cr_mirage_a_split_001',
  json('{
    "schemaVersion": 1,
    "caseRevision": "cr_mirage_a_split_001",
    "continuation": {
      "kind": "authored",
      "events": [
        {"timestamp": "00:55", "action": "The team re-smoked window and executed onto A with three smokes covering stairs, jungle, and CT.", "consequence": "The AWPer was locked behind the window smoke, unable to contribute. The split from connector and ramp overwhelmed the two defenders.", "state": "The bomb was planted on default with forty seconds remaining."}
      ]
    },
    "comparison": {
      "roundAction": "Full A execute with coordinated smokes after re-smoking window.",
      "materialInformation": "The confirmed AWP position at ticket booth and the faded window smoke.",
      "roundFollowup": "Re-smoking window was essential — it neutralised the AWP threat and restored the mid crossing."
    },
    "debrief": {
      "whyItWorks": "Three smokes isolate each defensive position on A site. The AWPer behind ticket booth cannot reposition through a window smoke. The split from connector and ramp creates two angles that a two-player defence cannot hold simultaneously.",
      "cost": "All three smokes are spent, leaving no utility for a post-plant retake defence.",
      "assumption": "The A site has exactly two defenders, and the AWPer is locked behind window.",
      "breaksWhen": "If a third CT rotated from B through connector undetected, the flank during the execute would catch the team off guard.",
      "evidenceReview": [
        {"evidenceId": "awp_position", "explanation": "The confirmed AWP at ticket booth made re-smoking window decisive — without it, crossing mid was suicide."},
        {"evidenceId": "utility_count", "explanation": "Three smokes allowed the full isolation execute. Fewer smokes would have forced a partial smoke that leaves a gap."}
      ],
      "followupReview": "Re-smoking window was the strongest response. Rushing without it exposes the mid crossing to the AWP. Rotating to B wastes the mid control advantage.",
      "strongestAlternative": "Executing immediately without re-smoking window. Faster, avoids utility cost, but the AWPer gets a free angle on the mid crossing.",
      "counterfactual": {"changedFact": "If the team had only two smokes remaining instead of three.", "effect": "The full isolation execute is impossible. A split through connector with only stairs and jungle smoked becomes the best option, accepting the risk from CT spawn."},
      "method": "Scenario constructed from documented professional Mirage A-site execute tactics and smoke lineups.",
      "sources": [
        {"label": "blast.tv", "detail": "CS2 mirage smokes — Learn the best smoke lineups"},
        {"label": "cs2pulse.com", "detail": "CS2 Mirage Smokes Guide — Learn the Best Mirage Smoke Spots"},
        {"label": "dignitas.gg", "detail": "Default Strategies on T-side: Virtus.Pro on de_mirage"}
      ]
    },
    "principle": "When an AWP position is confirmed and your smoke cover expires, re-smoking is not optional — it is the prerequisite for every other decision."
  }'),
  'sha256:mirage_a_split_reveal_001',
  '2024-06-02T00:00:00Z'
);

INSERT INTO case_rubrics (rubric_revision, case_revision, payload_json, checksum, created_at)
VALUES (
  'rr_mirage_a_split_001',
  'cr_mirage_a_split_001',
  json('{
    "schemaVersion": 1,
    "caseRevision": "cr_mirage_a_split_001",
    "rubricRevision": "rr_mirage_a_split_001",
    "dimensions": [
      {"id": "positioning", "weight": 50},
      {"id": "utility_efficiency", "weight": 50}
    ],
    "main": [
      {"actionId": "full_a_execute", "qualifierId": "smoke_stairs_jungle_ct", "ratings": {"positioning": 4, "utility_efficiency": 4}, "caps": []},
      {"actionId": "full_a_execute", "qualifierId": "smoke_stairs_jungle_only", "ratings": {"positioning": 4, "utility_efficiency": 3}, "caps": []},
      {"actionId": "split_a_through_connector", "qualifierId": "connector_first", "ratings": {"positioning": 3, "utility_efficiency": 3}, "caps": []},
      {"actionId": "split_a_through_connector", "qualifierId": "ramp_first", "ratings": {"positioning": 3, "utility_efficiency": 2}, "caps": []},
      {"actionId": "default_mid", "qualifierId": "slow_info", "ratings": {"positioning": 2, "utility_efficiency": 2}, "caps": []},
      {"actionId": "default_mid", "qualifierId": "fast_underpass", "ratings": {"positioning": 2, "utility_efficiency": 1}, "caps": []}
    ],
    "evidence": [
      {"actionId": "full_a_execute", "evidenceIds": ["awp_position", "utility_count"], "points": 18},
      {"actionId": "full_a_execute", "evidenceIds": ["mid_control_ev", "ct_positions"], "points": 16},
      {"actionId": "split_a_through_connector", "evidenceIds": ["connector_hold", "ct_positions"], "points": 14},
      {"actionId": "split_a_through_connector", "evidenceIds": ["awp_position", "connector_hold"], "points": 12},
      {"actionId": "default_mid", "evidenceIds": ["time_remaining", "mid_control_ev"], "points": 8}
    ],
    "followup": {
      "type": "new_information",
      "responses": [
        {"responseId": "resmoke_window", "quality": 90},
        {"responseId": "rush_now", "quality": 45},
        {"responseId": "abandon_mid", "quality": 20}
      ]
    }
  }'),
  'sha256:mirage_a_split_rubric_001',
  '2024-06-02T00:00:00Z'
);

INSERT INTO editions (
  edition_id, case_revision, release_at, official_end_at, grace_end_at,
  publication_status, public_metadata_json, created_at
) VALUES (
  'ed_mirage_a_split_001',
  'cr_mirage_a_split_001',
  '2024-06-02T06:00:00Z',
  '2030-12-31T23:59:59Z',
  '2031-01-01T05:59:59Z',
  'released',
  json('{"case_number": 2, "edition_date_utc": "2024-06-02", "estimated_minutes": 7, "focus": "Coordinated site execution with smokes", "origin_label": "Based on professional Mirage A-site split tactics"}'),
  '2024-06-02T00:00:00Z'
);


-- ═══════════════════════════════════════════════════════════════════
-- CASE 3 — Economy: Post-pistol round decision
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO cases (case_id, origin, created_at)
VALUES ('case_economy_postpistol_001', 'professional', '2024-06-03T00:00:00Z');

INSERT INTO case_revisions (case_revision, case_id, schema_version, checksum, status, created_at)
VALUES (
  'cr_economy_postpistol_001',
  'case_economy_postpistol_001',
  1,
  'sha256:economy_postpistol_001_rev1',
  'approved',
  '2024-06-03T00:00:00Z'
);

INSERT INTO case_public_briefs (case_revision, payload_json, checksum, created_at)
VALUES (
  'cr_economy_postpistol_001',
  json('{
    "schemaVersion": 1,
    "editionId": "ed_economy_postpistol_001",
    "caseRevision": "cr_economy_postpistol_001",
    "title": "The second-round gamble",
    "focus": "Economy management after losing the pistol round",
    "origin": "professional",
    "facts": [
      {"id": "pistol_loss", "status": "confirmed", "text": "Your team lost the pistol round. The opponents planted and won."},
      {"id": "team_money", "status": "confirmed", "text": "Each player has $1 900 after the loss bonus."},
      {"id": "opponent_economy", "status": "inferred", "text": "The opponent team has a full buy with SMGs and head armour after winning the pistol."},
      {"id": "player_survival", "status": "confirmed", "text": "No one on your team survived — all five died, so no saved weapons."},
      {"id": "map_side", "status": "confirmed", "text": "You are on the T side, round 2."}
    ],
    "actions": [
      {"id": "force_buy", "label": "Force buy — everyone buys armour and a Tec-9", "qualifierIds": ["rush_b", "spread_default"]},
      {"id": "full_eco", "label": "Full eco — save everything for round 3", "qualifierIds": ["hunt_exit", "stack_site"]},
      {"id": "half_buy", "label": "Half buy — armour only, play for picks", "qualifierIds": ["pistol_aim", "utility_focus"]}
    ],
    "qualifiers": [
      {"id": "rush_b", "label": "Rushing a single site together"},
      {"id": "spread_default", "label": "Playing a default spread and looking for picks"},
      {"id": "hunt_exit", "label": "Hunting for exit kills to damage their economy"},
      {"id": "stack_site", "label": "Stacking a site for a surprise hold"},
      {"id": "pistol_aim", "label": "Relying on pistol aim duels"},
      {"id": "utility_focus", "label": "Buying a smoke and flash instead of armour"}
    ],
    "evidence": [
      {"id": "loss_bonus", "label": "Current loss bonus stage"},
      {"id": "opponent_buy", "label": "Expected opponent equipment"},
      {"id": "team_economy", "label": "Team money after the loss"},
      {"id": "round_importance", "label": "Strategic importance of round 2"},
      {"id": "map_side_ev", "label": "T-side tactical options"}
    ],
    "confidence": [
      {"id": "guessing", "label": "Guessing"},
      {"id": "leaning", "label": "Leaning"},
      {"id": "fairly_sure", "label": "Fairly sure"},
      {"id": "strong_read", "label": "Strong read"}
    ]
  }'),
  'sha256:economy_postpistol_brief_001',
  '2024-06-03T00:00:00Z'
);

INSERT INTO case_followups (case_revision, payload_json, checksum, created_at)
VALUES (
  'cr_economy_postpistol_001',
  json('{
    "schemaVersion": 1,
    "caseRevision": "cr_economy_postpistol_001",
    "type": "new_information",
    "heading": "Teammate intel",
    "stimulus": "Your teammate reports that two opponents bought SMGs instead of rifles — likely expecting an eco round from your team.",
    "updates": [
      {"id": "smg_buy", "status": "new", "text": "At least two opponents are confirmed to carry SMGs, not rifles."}
    ],
    "responses": [
      {"id": "keep_plan", "label": "Stick with the original economic plan"},
      {"id": "upgrade_force", "label": "Upgrade to a force buy — SMGs are weaker at range"},
      {"id": "bait_aggression", "label": "Play passively to punish their expected aggression against an eco"}
    ]
  }'),
  'sha256:economy_postpistol_followup_001',
  '2024-06-03T00:00:00Z'
);

INSERT INTO case_reveals (case_revision, payload_json, checksum, created_at)
VALUES (
  'cr_economy_postpistol_001',
  json('{
    "schemaVersion": 1,
    "caseRevision": "cr_economy_postpistol_001",
    "continuation": {
      "kind": "authored",
      "events": [
        {"timestamp": "01:30", "action": "The team force-bought Tec-9s and armour, then stacked B site.", "consequence": "Two SMG-wielding opponents pushed aggressively into the stacked site and were traded out. The remaining CTs could not retake against the stolen weapons.", "state": "The force buy succeeded, evening the economy and breaking the opponent loss bonus."}
      ]
    },
    "comparison": {
      "roundAction": "Force buy with a site stack to exploit predicted SMG aggression.",
      "materialInformation": "The confirmation that opponents carried SMGs, indicating they expected an eco and planned to push aggressively.",
      "roundFollowup": "Upgrading to a force buy was the strongest response to the SMG intelligence — SMGs lose at range and their carriers push close."
    },
    "debrief": {
      "whyItWorks": "SMG carriers play close range and push aggressively because they expect defenceless eco opponents. Armour and Tec-9s at close range rival SMGs, and a stacked site gives the numerical advantage in the engagement.",
      "cost": "If the force buy fails, the team is on a deeper economic deficit — round 3 becomes a second eco, delaying the first full buy to round 4.",
      "assumption": "The opponents will push aggressively rather than hold defensive positions with their SMGs.",
      "breaksWhen": "If the opponents play passively with their SMGs and hold angles, the Tec-9 force buy loses its close-range advantage.",
      "evidenceReview": [
        {"evidenceId": "opponent_buy", "explanation": "SMG buys confirmed the opponents expected an eco — their play style becomes predictable: aggressive pushes for kill reward money."},
        {"evidenceId": "loss_bonus", "explanation": "At the first loss bonus stage, $1 900 is enough for armour and a Tec-9 but not a rifle — the force buy is the maximum available investment."}
      ],
      "followupReview": "Upgrading to a force buy after confirming SMGs is the highest-value response. SMG carriers expect unarmoured opponents — armour invalidates their damage model. Saving is safe but wastes the intelligence advantage.",
      "strongestAlternative": "Full eco and save for round 3. Guarantees a full buy next round but sacrifices the opportunity created by the SMG intelligence.",
      "counterfactual": {"changedFact": "If the opponents had bought rifles instead of SMGs.", "effect": "A force buy becomes much riskier — rifles kill armoured opponents efficiently at all ranges. The full eco into round 3 becomes the clearly safer choice."},
      "method": "Scenario constructed from documented CS2 professional economy management patterns and post-pistol decision frameworks.",
      "sources": [
        {"label": "scope.gg", "detail": "How does the economy work in CS:GO? Guide by SCOPE.GG"},
        {"label": "csmarketcap.com", "detail": "CS Economy Guide: Master CS In-Game Money Management for Victory"},
        {"label": "matchupworld.com", "detail": "CS2 Economy, Loss Bonus and Force Buys Explained"}
      ]
    },
    "principle": "When you have intelligence about the opponent equipment, use it. A force buy that exploits a known vulnerability is stronger than a safe eco that ignores the information."
  }'),
  'sha256:economy_postpistol_reveal_001',
  '2024-06-03T00:00:00Z'
);

INSERT INTO case_rubrics (rubric_revision, case_revision, payload_json, checksum, created_at)
VALUES (
  'rr_economy_postpistol_001',
  'cr_economy_postpistol_001',
  json('{
    "schemaVersion": 1,
    "caseRevision": "cr_economy_postpistol_001",
    "rubricRevision": "rr_economy_postpistol_001",
    "dimensions": [
      {"id": "economy_management", "weight": 60},
      {"id": "information_use", "weight": 40}
    ],
    "main": [
      {"actionId": "force_buy", "qualifierId": "rush_b", "ratings": {"economy_management": 3, "information_use": 3}, "caps": []},
      {"actionId": "force_buy", "qualifierId": "spread_default", "ratings": {"economy_management": 3, "information_use": 2}, "caps": []},
      {"actionId": "full_eco", "qualifierId": "hunt_exit", "ratings": {"economy_management": 4, "information_use": 2}, "caps": []},
      {"actionId": "full_eco", "qualifierId": "stack_site", "ratings": {"economy_management": 4, "information_use": 1}, "caps": []},
      {"actionId": "half_buy", "qualifierId": "pistol_aim", "ratings": {"economy_management": 2, "information_use": 2}, "caps": []},
      {"actionId": "half_buy", "qualifierId": "utility_focus", "ratings": {"economy_management": 2, "information_use": 3}, "caps": []}
    ],
    "evidence": [
      {"actionId": "force_buy", "evidenceIds": ["opponent_buy", "loss_bonus"], "points": 16},
      {"actionId": "force_buy", "evidenceIds": ["team_economy", "opponent_buy"], "points": 14},
      {"actionId": "full_eco", "evidenceIds": ["team_economy", "round_importance"], "points": 16},
      {"actionId": "full_eco", "evidenceIds": ["loss_bonus", "round_importance"], "points": 14},
      {"actionId": "half_buy", "evidenceIds": ["team_economy", "map_side_ev"], "points": 10}
    ],
    "followup": {
      "type": "new_information",
      "responses": [
        {"responseId": "keep_plan", "quality": 50},
        {"responseId": "upgrade_force", "quality": 88},
        {"responseId": "bait_aggression", "quality": 70}
      ]
    }
  }'),
  'sha256:economy_postpistol_rubric_001',
  '2024-06-03T00:00:00Z'
);

INSERT INTO editions (
  edition_id, case_revision, release_at, official_end_at, grace_end_at,
  publication_status, public_metadata_json, created_at
) VALUES (
  'ed_economy_postpistol_001',
  'cr_economy_postpistol_001',
  '2024-06-03T06:00:00Z',
  '2030-12-31T23:59:59Z',
  '2031-01-01T05:59:59Z',
  'released',
  json('{"case_number": 3, "edition_date_utc": "2024-06-03", "estimated_minutes": 5, "focus": "Economy management after pistol loss", "origin_label": "Based on professional CS2 economy decision patterns"}'),
  '2024-06-03T00:00:00Z'
);
