# Supabase SQL Schema Setup Instructions

## Overview

This document provides instructions for setting up your LunaBloom Spa booking system database in Supabase.

## Setup Steps

### 1. Access Your Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your project or create a new one

### 2. Open the SQL Editor

1. In your Supabase project dashboard, click on **SQL Editor** in the left sidebar
2. Click **New Query** to create a new SQL query

### 3. Execute the Schema

1. Open the file `supabase-complete-schema.sql` in this project
2. Copy the entire contents of the file
3. Paste it into the SQL Editor in Supabase
4. Click **Run** to execute the schema

The script will create:
- All necessary tables (admin_logins, admin_sessions, bookings)
- All RPC functions for admin and public operations
- Row Level Security policies
- Performance indexes
- A default admin account

### 4. Verify Installation

After running the script, verify the setup:

1. Go to **Table Editor** in Supabase
2. You should see three tables:
   - `admin_logins`
   - `admin_sessions`
   - `bookings`

3. Go to **Database** > **Functions** in Supabase
4. You should see these functions:
   - `admin_login`
   - `admin_logout`
   - `admin_create`
   - `is_admin_session`
   - `get_booking_counts_admin`
   - `list_bookings_admin`
   - `update_booking_status_admin`
   - `get_booked_slots`
   - `slot_taken`

## Default Admin Credentials

A default admin account is created with:

- **Username:** `bigsamcreates`
- **Admin Display Name:** `Big Sam`
- **Password:** `bigsamadmin`

**⚠️ IMPORTANT SECURITY NOTE:**
Change this password immediately after your first login! This is a default password and should not be used in production.

## Schema Features

### Bookings Table

The bookings table stores all spa service bookings with:

- Customer information (name, whatsapp, email)
- Service details (service type, date, time)
- Booking status (pending, confirmed, cancelled)
- Special notes/requests
- Automatic timestamps

**Key Constraints:**
- ✅ Cannot book dates in the past
- ✅ Status must be: pending, confirmed, or cancelled
- ✅ Required fields: name, whatsapp, service_type, preferred_date, preferred_time

### Admin Authentication

The admin system uses custom authentication (not Supabase Auth) with:

- Secure password hashing using bcrypt
- Token-based sessions with 30-day expiration
- Separate username (login) and admin_name (display)
- Row Level Security preventing direct table access

### RPC Functions

#### Public Functions (No Authentication Required)
- `get_booked_slots(date, service)` - Get booked time slots
- `slot_taken(date, service, time)` - Check if slot is available

#### Admin Functions (Require Valid Token)
- `admin_login(username, password)` - Returns token and admin_name
- `admin_logout(token)` - Invalidate session
- `get_booking_counts_admin(token, from, to)` - Dashboard statistics
- `list_bookings_admin(token, from, to, service, status)` - List bookings
- `update_booking_status_admin(token, id, status)` - Update booking status

## Row Level Security (RLS)

All tables have RLS enabled:

- **Anonymous users:** Can only INSERT into bookings table
- **Authenticated users:** Can SELECT bookings (for compatibility)
- **Admin operations:** All done through secure RPC functions with token validation
- **Direct table access:** Blocked for sensitive operations

## Performance Optimizations

The schema includes indexes for optimal performance:

- Date range queries
- Service type filtering
- Time slot availability checks
- Status filtering
- Recent bookings sorting

## Testing Your Setup

### Test Admin Login

You can test the admin login function in the SQL Editor:

```sql
SELECT * FROM admin_login('bigsamcreates', 'bigsamadmin');
```

Expected result: A row with `token` (uuid) and `admin_name` (text)

### Test Booking Creation

You can test creating a booking:

```sql
INSERT INTO bookings (name, whatsapp, email, service_type, preferred_date, preferred_time, notes)
VALUES ('Test Customer', '+233501234567', 'test@example.com', 'Full Body Massage', '2025-11-01', '14:00', 'Test booking');
```

### Test Availability Check

```sql
SELECT * FROM get_booked_slots('2025-11-01', 'Full Body Massage');
```

## Troubleshooting

### Error: "relation 'bookings' already exists"

If you get this error, tables already exist. You have two options:

1. **Keep existing data:** Comment out the CREATE TABLE statements in the schema
2. **Fresh start:** Drop existing tables first:
   ```sql
   DROP TABLE IF EXISTS bookings CASCADE;
   DROP TABLE IF EXISTS admin_sessions CASCADE;
   DROP TABLE IF EXISTS admin_logins CASCADE;
   ```
   Then run the complete schema again.

### Error: "function already exists"

This is normal - the schema uses `CREATE OR REPLACE FUNCTION` which safely updates existing functions.

### Past Date Constraint Error

If you try to book a date in the past, you'll get:
```
ERROR: new row violates check constraint "no_past_dates"
```

This is expected behavior to prevent invalid bookings.

## Changing Admin Password

To change the admin password after first login:

```sql
UPDATE admin_logins
SET password_hash = crypt('your_new_secure_password', gen_salt('bf'))
WHERE username = 'bigsamcreates';
```

## Adding Additional Admin Accounts

```sql
SELECT admin_create('new_username', 'Display Name', 'secure_password');
```

## Support

If you encounter any issues:

1. Check that all tables were created successfully
2. Verify all functions appear in the Database > Functions section
3. Ensure your Supabase project has the pgcrypto extension enabled
4. Check the Supabase logs for detailed error messages

## Security Best Practices

1. ✅ Change default admin password immediately
2. ✅ Use strong passwords for admin accounts
3. ✅ Regularly review admin sessions and expire old tokens
4. ✅ Keep your Supabase project API keys secure
5. ✅ Never commit sensitive credentials to version control
6. ✅ Monitor booking submissions for abuse

## Next Steps

After setting up the schema:

1. Test the admin login at `/admin` route in your application
2. Create a test booking at `/booking` route
3. Verify the booking appears in the admin dashboard
4. Test updating booking statuses
5. Try the CSV export feature in the admin dashboard

Your LunaBloom Spa booking system is now ready to use!
