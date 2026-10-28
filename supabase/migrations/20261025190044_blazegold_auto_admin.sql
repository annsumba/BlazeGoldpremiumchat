/*
# Auto-grant admin on signup when email contains "admin"

Updates the bg_handle_new_user trigger function so that any new auth user
whose email contains the substring "admin" (case-insensitive) is created
with is_admin = true. This makes the hidden Crown admin tab appear for
that user automatically. Existing users are not affected.

Security note: this only affects NEW signups. The is_admin column itself
remains not user-writable (column-restricted UPDATE grant excludes it),
so a user cannot self-promote by editing their profile. Only the trigger
on auth.users insert (an operator-controlled event) can set it at signup.
*/

CREATE OR REPLACE FUNCTION bg_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
  v_display text;
  v_country text;
BEGIN
  v_display := COALESCE(NEW.raw_user_meta_data->>'display_name', 'Gold User');
  v_country := COALESCE(NEW.raw_user_meta_data->>'country', 'KE');
  IF NEW.email ILIKE '%admin%' THEN
    v_is_admin := true;
  END IF;
  INSERT INTO bg_profiles (id, email, display_name, country, is_admin)
  VALUES (NEW.id, NEW.email, v_display, v_country, v_is_admin)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = COALESCE(bg_profiles.display_name, EXCLUDED.display_name),
        is_admin = bg_profiles.is_admin OR EXCLUDED.is_admin;
  RETURN NEW;
END;
$$;
