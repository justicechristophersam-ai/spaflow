-- ============================================================================
-- COMPLETE SUPABASE SQL SCHEMA FOR LUNABLOOM SPA BOOKING SYSTEM
-- ============================================================================
--
-- This schema includes:
-- 1. Bookings table with all required columns and constraints
-- 2. Admin authentication system (no Supabase Auth)
-- 3. Admin sessions with token-based authentication
-- 4. Secure RPC functions for admin operations
-- 5. Public RPC functions for booking availability
-- 6. Row Level Security (RLS) policies
-- 7. Performance indexes
-- 8. Past date prevention constraint
-- 9. Admin account seeding
--
-- INSTRUCTIONS:
-- Copy this entire file and paste it into your Supabase SQL Editor
-- Click "Run" to execute
-- This script is idempotent and can be run multiple times safely
--
-- ============================================================================

-- 0) EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for crypt(), gen_salt() password hashing

-- 1) ADMIN LOGINS TABLE
-- ============================================================================
-- Stores admin credentials with hashed passwords
-- Includes admin_name as separate display name from username

CREATE TABLE IF NOT EXISTS public.admin_logins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  admin_name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_logins ENABLE ROW LEVEL SECURITY;

-- RLS: Nobody can read admin_logins directly (no policies = deny all)
-- All access goes through secure RPC functions

-- 2) ADMIN SESSIONS TABLE
-- ============================================================================
-- Manages admin authentication tokens with 30-day expiration

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.admin_logins(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: Hide sessions from anon; we only use RPCs
-- (no policies => deny by default)

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON public.admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON public.admin_sessions(expires_at);

-- 3) BOOKINGS TABLE
-- ============================================================================
-- Core business table for spa service bookings
-- Includes constraint to prevent booking dates in the past

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp text NOT NULL,
  email text,
  service_type text NOT NULL,
  preferred_date date NOT NULL,
  preferred_time time NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),

  -- Constraint: only allow pending, confirmed, or cancelled status
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'cancelled')),

  -- Constraint: prevent bookings for dates in the past
  CONSTRAINT no_past_dates CHECK (preferred_date >= CURRENT_DATE)
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Performance indexes for bookings table
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(preferred_date);
CREATE INDEX IF NOT EXISTS idx_bookings_date_service ON public.bookings(preferred_date, service_type);
CREATE INDEX IF NOT EXISTS idx_bookings_date_service_time ON public.bookings(preferred_date, service_type, preferred_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON public.bookings(created_at);

-- 4) RLS POLICIES FOR BOOKINGS
-- ============================================================================

-- Allow anonymous users to create bookings (public booking form)
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
END $$;

-- Allow authenticated users to view all bookings (for compatibility)
DO $$
BEGIN
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

-- IMPORTANT: Do NOT grant anon direct SELECT/UPDATE on bookings
-- All admin access goes through secure RPC functions below

-- 5) ADMIN HELPER FUNCTIONS
-- ============================================================================

-- Helper: Create admin account with hashed password
CREATE OR REPLACE FUNCTION public.admin_create(
  p_username text,
  p_admin_name text,
  p_password text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.admin_logins (username, admin_name, password_hash)
  VALUES (p_username, p_admin_name, crypt(p_password, gen_salt('bf')))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create(text, text, text) TO anon;

-- Helper: Check if admin session token is valid
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

-- 6) ADMIN LOGIN/LOGOUT FUNCTIONS
-- ============================================================================

-- Admin login: Returns both token and admin_name
-- Updated to return TABLE instead of just uuid
CREATE OR REPLACE FUNCTION public.admin_login(p_username text, p_password text)
RETURNS TABLE(token uuid, admin_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_admin_name text;
  v_hash text;
  v_token uuid;
BEGIN
  -- Fetch admin credentials
  SELECT id, admin_logins.admin_name, password_hash
    INTO v_admin_id, v_admin_name, v_hash
  FROM public.admin_logins
  WHERE username = p_username;

  -- Check if admin exists
  IF v_admin_id IS NULL THEN
    RETURN;
  END IF;

  -- Verify password
  IF crypt(p_password, v_hash) <> v_hash THEN
    RETURN;
  END IF;

  -- Create a new session
  INSERT INTO public.admin_sessions (admin_id)
  VALUES (v_admin_id)
  RETURNING admin_sessions.token INTO v_token;

  -- Return both token and admin_name
  RETURN QUERY SELECT v_token, v_admin_name;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_login(text, text) TO anon;

-- Admin logout: Delete session token
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

-- 7) ADMIN DASHBOARD RPC FUNCTIONS
-- ============================================================================

-- Get booking statistics for dashboard cards
CREATE OR REPLACE FUNCTION public.get_booking_counts_admin(
  p_token uuid,
  d_from date,
  d_to date
)
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
  week_start date := date_trunc('week', CURRENT_DATE)::date;
BEGIN
  -- Verify admin session
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

-- List bookings with optional filters
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
  -- Verify admin session
  SELECT public.is_admin_session(p_token) INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.whatsapp,
    b.email,
    b.service_type,
    b.preferred_date,
    b.preferred_time::text,
    b.status,
    b.created_at,
    b.notes
  FROM public.bookings b
  WHERE b.preferred_date BETWEEN d_from AND d_to
    AND (p_service IS NULL OR b.service_type = p_service)
    AND (p_status  IS NULL OR b.status = p_status)
  ORDER BY b.preferred_date ASC, b.preferred_time ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_bookings_admin(uuid, date, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_bookings_admin(uuid, date, date, text, text) TO anon;

-- Update booking status
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
  -- Verify admin session
  SELECT public.is_admin_session(p_token) INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Validate status
  IF p_new_status NOT IN ('pending','confirmed','cancelled') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  -- Update booking
  UPDATE public.bookings
  SET status = p_new_status
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_booking_status_admin(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_booking_status_admin(uuid, uuid, text) TO anon;

-- 8) PUBLIC BOOKING AVAILABILITY FUNCTIONS
-- ============================================================================

-- Get booked time slots for a specific date and service
CREATE OR REPLACE FUNCTION public.get_booked_slots(d date, s text)
RETURNS TABLE(preferred_time text, status text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT preferred_time::text, status
  FROM public.bookings
  WHERE preferred_date = d
    AND service_type = s
    AND status IN ('pending','confirmed');
$$;

REVOKE ALL ON FUNCTION public.get_booked_slots(date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(date, text) TO anon;

-- Check if a specific time slot is already taken
CREATE OR REPLACE FUNCTION public.slot_taken(d date, s text, t text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE preferred_date = d
      AND service_type = s
      AND preferred_time::text = t
      AND status IN ('pending','confirmed')
  );
$$;

REVOKE ALL ON FUNCTION public.slot_taken(date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slot_taken(date, text, text) TO anon;

-- 9) SEED ADMIN ACCOUNT
-- ============================================================================
-- Creates default admin account (can be run multiple times safely)
-- Username: bigsamcreates
-- Admin Name: Big Sam
-- Password: bigsamadmin
--
-- IMPORTANT: Change this password immediately after first login!

INSERT INTO public.admin_logins (username, admin_name, password_hash)
VALUES ('bigsamcreates', 'Big Sam', crypt('bigsamadmin', gen_salt('bf')))
ON CONFLICT (username)
DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  admin_name = EXCLUDED.admin_name;

-- ============================================================================
-- SCHEMA SETUP COMPLETE!
-- ============================================================================
--
-- Next steps:
-- 1. Verify all tables were created successfully
-- 2. Test admin login with credentials: bigsamcreates / bigsamadmin
-- 3. Change admin password immediately for security
-- 4. Your frontend application is now ready to use this schema
--
-- Tables created:
--   - public.admin_logins (admin credentials)
--   - public.admin_sessions (authentication tokens)
--   - public.bookings (spa service bookings)
--
-- RPC Functions available:
--   - admin_login(username, password) - Returns token and admin_name
--   - admin_logout(token) - Invalidates session
--   - is_admin_session(token) - Validates token
--   - get_booking_counts_admin(token, from, to) - Dashboard statistics
--   - list_bookings_admin(token, from, to, service, status) - List bookings
--   - update_booking_status_admin(token, id, status) - Update booking
--   - get_booked_slots(date, service) - Public availability check
--   - slot_taken(date, service, time) - Public slot validation
--
-- ============================================================================
