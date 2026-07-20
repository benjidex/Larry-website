-- Supabase SQL Schema: Bookings table
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)
-- Replace with your project reference from SUPABASE_URL

-- Create bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  date DATE NOT NULL,
  service TEXT NOT NULL,
  message TEXT NOT NULL
);

--Add linkage column
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS user_id uuid;

--Set user_id automatically when authenticated
CREATE OR REPLACE FUNCTION public.set_booking_user_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If the request has an authenticated user, stamp their id
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_booking_user_id ON public.bookings;
CREATE TRIGGER trg_set_booking_user_id
BEFORE INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.set_booking_user_id();

--Enable RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--INSERT policy (anonymous can insert)
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.bookings;
CREATE POLICY "Allow anonymous inserts"
ON public.bookings
FOR INSERT
TO anon
WITH CHECK (true);

--INSERT policy (authenticated can insert too, stamped via trigger)
DROP POLICY IF EXISTS "Allow authenticated inserts" ON public.bookings;
CREATE POLICY "Allow authenticated inserts"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (true);

--SELECT policy: only “own” rows (authenticated)
DROP POLICY IF EXISTS "Allow authenticated read own" ON public.bookings;
CREATE POLICY "Allow authenticated read own"
ON public.bookings
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

--Ensure anonymous cannot read (if you previously created an anon SELECT policy)
DROP POLICY IF EXISTS "Allow anon read own" ON public.bookings;