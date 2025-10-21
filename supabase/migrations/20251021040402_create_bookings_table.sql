/*
  # Create bookings table for LunaBloom Spa

  1. New Tables
    - `bookings`
      - `id` (uuid, primary key) - Unique booking identifier
      - `name` (text) - Customer name
      - `whatsapp` (text) - WhatsApp contact number
      - `email` (text, optional) - Customer email
      - `service_type` (text) - Selected spa service
      - `preferred_date` (date) - Requested appointment date
      - `preferred_time` (text) - Requested appointment time
      - `notes` (text, optional) - Special requests or notes
      - `created_at` (timestamptz) - Booking creation timestamp
      
  2. Security
    - Enable RLS on `bookings` table
    - Add policy for public insert (allow customers to book)
    - Add policy for authenticated read (staff can view bookings)
*/

CREATE TABLE IF NOT EXISTS bookings (
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

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create bookings"
  ON bookings
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view all bookings"
  ON bookings
  FOR SELECT
  TO authenticated
  USING (true);