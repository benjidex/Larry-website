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

-- Enable Row Level Security (optional, recommended)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (so your booking form can work without auth)
CREATE POLICY "Allow anonymous inserts" ON public.bookings
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow reading bookings (if you want to list them later)
CREATE POLICY "Allow anon read own" ON public.bookings
  FOR SELECT
  TO anon
  USING (true);

-- Optional: Index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings (created_at DESC);

