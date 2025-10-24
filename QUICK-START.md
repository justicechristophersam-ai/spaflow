# Quick Start - Supabase Schema Setup

## 3-Step Setup

### Step 1: Copy the SQL Schema
Open the file: `supabase-complete-schema.sql`

### Step 2: Execute in Supabase
1. Go to your Supabase project → **SQL Editor**
2. Click **New Query**
3. Paste the entire schema
4. Click **Run**

### Step 3: Test Your Setup
1. Go to `/admin` in your app
2. Login with:
   - Username: `bigsamcreates`
   - Password: `bigsamadmin`
3. **Change this password immediately!**

## What Gets Created

### Tables
- ✅ `bookings` - Store spa bookings
- ✅ `admin_logins` - Admin credentials
- ✅ `admin_sessions` - Auth tokens

### Key Features
- ✅ Cannot book past dates
- ✅ Secure password hashing
- ✅ Token-based admin auth
- ✅ Real-time availability checking
- ✅ Performance optimized with indexes

### Functions Available
```sql
-- Public (no auth needed)
get_booked_slots(date, service)
slot_taken(date, service, time)

-- Admin (requires token)
admin_login(username, password)
admin_logout(token)
get_booking_counts_admin(token, from, to)
list_bookings_admin(token, from, to, service, status)
update_booking_status_admin(token, id, status)
```

## Test It Works

### Test Admin Login
```sql
SELECT * FROM admin_login('bigsamcreates', 'bigsamadmin');
```
Should return: `{ token: uuid, admin_name: "Big Sam" }`

### Create Test Booking
```sql
INSERT INTO bookings (name, whatsapp, email, service_type, preferred_date, preferred_time)
VALUES ('Test', '+233501234567', 'test@example.com', 'Full Body Massage', CURRENT_DATE + 1, '14:00');
```

### Check Availability
```sql
SELECT * FROM get_booked_slots(CURRENT_DATE + 1, 'Full Body Massage');
```

## Important Notes

⚠️ **Security:** Change default admin password immediately!

⚠️ **Past Dates:** Bookings for past dates are automatically blocked

⚠️ **RLS Enabled:** All tables have Row Level Security enabled

✅ **Idempotent:** Safe to run multiple times

✅ **No Data Loss:** Uses `IF NOT EXISTS` clauses

## Need Help?

See `SUPABASE-SETUP-INSTRUCTIONS.md` for detailed documentation.
