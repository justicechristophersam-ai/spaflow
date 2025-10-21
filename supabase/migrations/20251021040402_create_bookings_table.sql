/*
  # Secure availability via RPC (no anon table reads)

  Adds:
    - get_booked_slots(date d, text s) → (preferred_time text, status text)
    - slot_taken(date d, text s, text t) → bool
  Grants EXECUTE to anon only on these functions.

  Removes:
    - The anon SELECT policy used previously for availability.
*/

-- Keep these from the previous migration (no-op if already present)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS bookings_unique_active_slot
ON public.bookings (service_type, preferred_date, preferred_time)
WHERE status IN ('pending','confirmed');

CREATE INDEX IF NOT EXISTS bookings_lookup_idx
ON public.bookings (preferred_date, service_type, status);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Keep original policies (insert for anon, select for authenticated)
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

-- 🔒 Remove anon table read for availability if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Anon can read future availability only'
      AND tablename = 'bookings'
  ) THEN
    DROP POLICY "Anon can read future availability only" ON public.bookings;
  END IF;
END $$;

-- ✅ RPC: list booked slots for a given date+service
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

-- ✅ RPC: quick boolean to check if a slot is already taken
CREATE OR REPLACE FUNCTION public.slot_taken(d date, s text, t text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE preferred_date = d
      AND service_type   = s
      AND preferred_time = t
      AND status IN ('pending','confirmed')
  );
$$;

REVOKE ALL ON FUNCTION public.slot_taken(date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slot_taken(date, text, text) TO anon;

COMMENT ON FUNCTION public.get_booked_slots(date, text) IS
'Returns booked times (pending/confirmed) for availability rendering.';

COMMENT ON FUNCTION public.slot_taken(date, text, text) IS
'Fast boolean to re-check a slot just before insert.';
