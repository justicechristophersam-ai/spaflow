-- ============================================
-- Admin login (no Supabase Auth) + secure RPCs
-- ============================================

-- 0) extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for crypt(), gen_salt()

-- 1) Admin credentials (hashed)
CREATE TABLE IF NOT EXISTS public.admin_logins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_logins ENABLE ROW LEVEL SECURITY;

-- RLS: nobody can read admin_logins directly (no policies = deny)
-- (We’ll only expose RPCs.)

-- Helper: create admin (hashes password)
CREATE OR REPLACE FUNCTION public.admin_create(p_username text, p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.admin_logins (username, password_hash)
  VALUES (p_username, crypt(p_password, gen_salt('bf')))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create(text, text) TO anon;

-- 2) Admin sessions
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.admin_logins(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: hide sessions from anon; we only use RPCs
-- (no policies => deny by default)

-- is_admin_session(token) → bool
CREATE OR REPLACE FUNCTION public.is_admin_session(p_token uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.admin_sessions
    WHERE token = p_token
      AND now() < expires_at
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_session(uuid) TO anon;

-- login(username, password) → token (uuid) or NULL
CREATE OR REPLACE FUNCTION public.admin_login(p_username text, p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_hash text;
  v_token uuid;
BEGIN
  SELECT id, password_hash
    INTO v_admin_id, v_hash
  FROM public.admin_logins
  WHERE username = p_username;

  IF v_admin_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF crypt(p_password, v_hash) <> v_hash THEN
    RETURN NULL;
  END IF;

  -- create a new session
  INSERT INTO public.admin_sessions (admin_id)
  VALUES (v_admin_id)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_login(text, text) TO anon;

-- logout(token) → void
CREATE OR REPLACE FUNCTION public.admin_logout(p_token uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.admin_sessions WHERE token = p_token;
$$;

REVOKE ALL ON FUNCTION public.admin_logout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_logout(uuid) TO anon;

-- 3) Existing bookings table protections (keep what you have)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Keep original open/insert + staff-read policy; or remove staff-read if you don't use authenticated role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Anyone can create bookings'
      AND tablename = 'bookings'
  ) THEN
    CREATE POLICY "Anyone can create bookings"
      ON public.bookings
      FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;

  -- You can keep this if you have an authenticated role in some contexts;
  -- it won't be used by the anon client.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can view all bookings'
      AND tablename = 'bookings'
  ) THEN
    CREATE POLICY "Authenticated users can view all bookings"
      ON public.bookings
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- IMPORTANT: do NOT grant anon direct SELECT/UPDATE on bookings.
-- All admin access goes through the RPCs below.

-- 4) Admin-only RPCs (guarded by is_admin_session(token))

-- a) Stats for dashboard cards
CREATE OR REPLACE FUNCTION public.get_booking_counts_admin(p_token uuid, d_from date, d_to date)
RETURNS TABLE(
  total bigint,
  pending bigint,
  confirmed bigint,
  cancelled bigint,
  today bigint,
  this_week bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean;
  week_start date := date_trunc('week', CURRENT_DATE)::date; -- Monday
BEGIN
  SELECT public.is_admin_session(p_token) INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE preferred_date BETWEEN d_from AND d_to) AS total,
    COUNT(*) FILTER (WHERE status='pending'   AND preferred_date BETWEEN d_from AND d_to) AS pending,
    COUNT(*) FILTER (WHERE status='confirmed' AND preferred_date BETWEEN d_from AND d_to) AS confirmed,
    COUNT(*) FILTER (WHERE status='cancelled' AND preferred_date BETWEEN d_from AND d_to) AS cancelled,
    COUNT(*) FILTER (WHERE preferred_date = CURRENT_DATE) AS today,
    COUNT(*) FILTER (WHERE preferred_date BETWEEN week_start AND (week_start + 6)) AS this_week
  FROM public.bookings;
END;
$$;

REVOKE ALL ON FUNCTION public.get_booking_counts_admin(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_counts_admin(uuid, date, date) TO anon;

-- b) List bookings (date range + optional filters)
CREATE OR REPLACE FUNCTION public.list_bookings_admin(
  p_token uuid,
  d_from date,
  d_to date,
  p_service text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  name text,
  whatsapp text,
  email text,
  service_type text,
  preferred_date date,
  preferred_time text,
  status text,
  created_at timestamptz,
  notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean;
BEGIN
  SELECT public.is_admin_session(p_token) INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    b.id, b.name, b.whatsapp, b.email, b.service_type,
    b.preferred_date, b.preferred_time, b.status, b.created_at, b.notes
  FROM public.bookings b
  WHERE b.preferred_date BETWEEN d_from AND d_to
    AND (p_service IS NULL OR b.service_type = p_service)
    AND (p_status  IS NULL OR b.status = p_status)
  ORDER BY b.preferred_date ASC, b.preferred_time ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_bookings_admin(uuid, date, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_bookings_admin(uuid, date, date, text, text) TO anon;

-- c) Update booking status (pending/confirmed/cancelled)
CREATE OR REPLACE FUNCTION public.update_booking_status_admin(
  p_token uuid,
  p_id uuid,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean;
BEGIN
  SELECT public.is_admin_session(p_token) INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_new_status NOT IN ('pending','confirmed','cancelled') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE public.bookings
  SET status = p_new_status
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_booking_status_admin(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_booking_status_admin(uuid, uuid, text) TO anon;

-- 5) Keep your availability RPCs (as you pasted)
-- get_booked_slots(d, s) and slot_taken(d, s, t) — already created earlier.
-- (Repeat here safely: CREATE OR REPLACE ...)

CREATE OR REPLACE FUNCTION public.get_booked_slots(d date, s text)
RETURNS TABLE(preferred_time text, status text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT preferred_time, status
  FROM public.bookings
  WHERE preferred_date = d
    AND service_type   = s
    AND status IN ('pending','confirmed');
$$;

REVOKE ALL ON FUNCTION public.get_booked_slots(date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(date, text) TO anon;

CREATE OR REPLACE FUNCTION public.slot_taken(d date, s text, t text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE preferred_date = d
      AND service_type   = s
      AND preferred_time = t
      AND status IN ('pending','confirmed')
  );
$$;

REVOKE ALL ON FUNCTION public.slot_taken(date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slot_taken(date, text, text) TO anon;

-- 6) Seed or reset the admin account to your chosen credentials
-- Username: bigsamcreates
-- Password: bigsamadmin
INSERT INTO public.admin_logins (username, password_hash)
VALUES ('bigsamcreates', crypt('bigsamadmin', gen_salt('bf')))
ON CONFLICT (username)
DO UPDATE SET password_hash = EXCLUDED.password_hash;

