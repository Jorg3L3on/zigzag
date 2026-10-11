-- Forced password change after a temporary password (ZIG-I18-11). There is no
-- email in Zigzag, so recovery is an admin/operator giving a temporary password
-- that the person must replace at their next login. Existing users are unaffected.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "must_change_password" boolean NOT NULL DEFAULT false;
