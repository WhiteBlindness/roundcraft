-- Retired: this migration intentionally does nothing.
--
-- It used to seed three draft cases (Inferno banana, Mirage A split and a
-- post-pistol economy round). Those cases were never reviewed, their rubrics
-- were incomplete, and they were mislabelled as professional scenarios. This
-- file had NOT been applied to the production database when it was retired
-- (production d1_migrations contained only 0001_initial.sql), so replacing its
-- body cannot change any deployed schema or data.
--
-- The cases now live, unchanged apart from honesty fixes, as drafts in
-- content/cases/ pending tactical review. Playable cases are published only
-- through generated, append-only migrations (npm run content:build); see
-- content/README.md. The filename is kept so migration numbering stays stable.

SELECT 1;
