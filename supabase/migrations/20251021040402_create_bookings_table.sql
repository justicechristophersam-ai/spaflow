/*
  # Update bookings table for LunaBloom Spa availability logic

  1. Existing table stays the same — we’re adding:
     - `status` column (default 'pending')
     - Unique index on (service_type, preferred_date, preferred_time)
       for active bookings only
     - Lookup index to speed up availability queries

  2. Add RLS policy to allow anon (public) read access ONLY to
     future bookings for checking available times.
*/

-- 🧘‍♀️ Ensure bookings table exists
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp text NOT NULL,
  email text DEFAULT '',
  service_type text NOT NULL,
  preferred_date date NOT NULL,
  preferred_time text NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- ✅ New column for booking lifecycle
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- ✅ Unique active booking per service/date/time
CREATE UNIQUE INDEX IF NOT EXISTS bookings_unique_active_slot
ON public.bookings (service_type, preferred_date, preferred_time)
WHERE status IN ('pending', 'confirmed');

-- ✅ Lookup index for faster frontend availability queries
CREATE INDEX IF NOT EXISTS bookings_lookup_idx
ON public.bookings (preferred_date, service_type, status);

-- ✅ Enable Row Level Security (keep your setup)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 🔒 Keep your existing policies
DO $$
BEGIN
  -- Insert policy (public booking)
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

  -- Select policy (staff)
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

-- ✅ NEW: allow public read only for future dates (for availability)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Anon can read future availability only'
      AND tablename = 'bookings'
  ) THEN
    CREATE POLICY "Anon can read future availability only"
      ON public.bookings
      FOR SELECT
      TO anon
      USING (preferred_date >= CURRENT_DATE);
  END IF;
END $$;

COMMENT ON TABLE public.bookings IS
'LunaBloom Spa bookings with unique per-slot restriction and limited public read access for availability checks.';
