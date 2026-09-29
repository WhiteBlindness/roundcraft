-- Retired: local seed data now has a single source of truth.
--
-- The local preview fixture ("The last smoke") lives in
-- content/fixtures/case_smoke_001.json and is loaded into the local D1
-- database with:
--
--   npm run content:preview -- case_smoke_001
--
-- Any draft or ready case in content/cases/ can be previewed the same way.
-- This file is kept only so old instructions fail harmlessly.

SELECT 1;
