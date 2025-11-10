/*
  # Add Change Password Function for Admin

  1. New Functions
    - `change_admin_password(token, old_password, new_password)` - Allows admin to change their password securely
  
  2. Security
    - Validates admin session token
    - Verifies old password matches current hash
    - Hashes new password with bcrypt
    - Updates password_hash in admin_logins table
    - Returns success or error message

  3. Implementation Details
    - Function checks token validity first
    - Retrieves admin ID and current password hash
    - Verifies old password using crypt
    - Updates password only if old password is correct
    - Returns error for invalid token or incorrect password
*/

CREATE OR REPLACE FUNCTION public.change_admin_password(
  p_token uuid,
  p_old_password text,
  p_new_password text
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_current_hash text;
BEGIN
  -- Verify admin session token is valid
  SELECT admin_id INTO v_admin_id
  FROM public.admin_sessions
  WHERE token = p_token
    AND now() < expires_at;

  IF v_admin_id IS NULL THEN
    RETURN QUERY SELECT false, 'Invalid or expired session token'::text;
    RETURN;
  END IF;

  -- Fetch current password hash
  SELECT password_hash INTO v_current_hash
  FROM public.admin_logins
  WHERE id = v_admin_id;

  IF v_current_hash IS NULL THEN
    RETURN QUERY SELECT false, 'Admin account not found'::text;
    RETURN;
  END IF;

  -- Verify old password is correct
  IF crypt(p_old_password, v_current_hash) <> v_current_hash THEN
    RETURN QUERY SELECT false, 'Current password is incorrect'::text;
    RETURN;
  END IF;

  -- Validate new password is not empty and meets minimum length
  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RETURN QUERY SELECT false, 'New password must be at least 8 characters long'::text;
    RETURN;
  END IF;

  -- Update password hash
  UPDATE public.admin_logins
  SET password_hash = crypt(p_new_password, gen_salt('bf'))
  WHERE id = v_admin_id;

  -- Return success
  RETURN QUERY SELECT true, 'Password changed successfully'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.change_admin_password(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_admin_password(uuid, text, text) TO anon;