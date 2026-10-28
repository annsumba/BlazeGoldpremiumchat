/*
# Add voice status type

1. Schema change
- bg_status.type CHECK constraint now also allows 'voice' so users can
  post recorded voice notes as status updates alongside photos and text.
- No new columns: voice notes reuse the existing attachment_url column
  (audio file stored in the blazegold storage bucket, same as images).
2. Security
- No policy changes. Existing bg_status RLS (owner-scoped CRUD for
  authenticated users) and blazegold storage policies (authenticated
  upload, public read) already cover voice attachments.
- Storage bucket 'blazegold' is reused; no new bucket needed.
3. Notes
- The constraint is dropped and recreated with the expanded allowlist.
- No data is lost; existing rows satisfy the new constraint.
*/

ALTER TABLE bg_status DROP CONSTRAINT IF EXISTS bg_status_type_check;

ALTER TABLE bg_status ADD CONSTRAINT bg_status_type_check
  CHECK (type in ('text','image','video','voice'));
