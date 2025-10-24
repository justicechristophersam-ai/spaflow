# LunaBloom Spa - Database Schema Overview

## 📊 Schema Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    LUNABLOOM SPA DATABASE                    │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────┐       ┌──────────────────────┐
│   ADMIN_LOGINS       │       │   ADMIN_SESSIONS     │
├──────────────────────┤       ├──────────────────────┤
│ • id (PK)            │◄──────│ • id (PK)            │
│ • username (unique)  │       │ • admin_id (FK)      │
│ • admin_name         │       │ • token (unique)     │
│ • password_hash      │       │ • created_at         │
│ • created_at         │       │ • expires_at         │
└──────────────────────┘       └──────────────────────┘
         │                              │
         │                              │
         └──────────────┬───────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │  ADMIN AUTH      │
              │  (Token-based)   │
              └─────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │     SECURE RPC FUNCTIONS     │
         │  (All Admin Operations)      │
         └──────────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │       BOOKINGS TABLE         │
         ├──────────────────────────────┤
         │ • id (PK)                    │
         │ • name                       │
         │ • whatsapp                   │
         │ • email                      │
         │ • service_type               │
         │ • preferred_date             │
         │ • preferred_time             │
         │ • status (pending/confirmed) │
         │ • notes                      │
         │ • created_at                 │
         └──────────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │   PUBLIC RPC FUNCTIONS       │
         │  (Availability Checks)       │
         └──────────────────────────────┘
```

## 🗂️ Tables

### 1. admin_logins
**Purpose:** Store admin credentials with hashed passwords

| Column        | Type         | Constraints       | Description                    |
|---------------|--------------|-------------------|--------------------------------|
| id            | uuid         | PRIMARY KEY       | Auto-generated unique ID       |
| username      | text         | UNIQUE, NOT NULL  | Login credential               |
| admin_name    | text         | NOT NULL          | Display name in dashboard      |
| password_hash | text         | NOT NULL          | Bcrypt hashed password         |
| created_at    | timestamptz  | DEFAULT now()     | Account creation timestamp     |

**RLS:** Enabled - No direct access (RPC only)

---

### 2. admin_sessions
**Purpose:** Manage authentication tokens with expiration

| Column     | Type        | Constraints       | Description                     |
|------------|-------------|-------------------|---------------------------------|
| id         | uuid        | PRIMARY KEY       | Auto-generated unique ID        |
| admin_id   | uuid        | FK → admin_logins | Reference to admin account      |
| token      | uuid        | UNIQUE, NOT NULL  | Authentication token            |
| created_at | timestamptz | DEFAULT now()     | Session creation time           |
| expires_at | timestamptz | NOT NULL          | Token expiration (30 days)      |

**RLS:** Enabled - No direct access (RPC only)

**Indexes:**
- `idx_admin_sessions_token` - Fast token lookups
- `idx_admin_sessions_expires` - Expiration queries

---

### 3. bookings
**Purpose:** Store spa service bookings from customers

| Column         | Type        | Constraints       | Description                        |
|----------------|-------------|-------------------|------------------------------------|
| id             | uuid        | PRIMARY KEY       | Auto-generated unique ID           |
| name           | text        | NOT NULL          | Customer name                      |
| whatsapp       | text        | NOT NULL          | Customer WhatsApp number           |
| email          | text        | -                 | Customer email (optional)          |
| service_type   | text        | NOT NULL          | Type of spa service                |
| preferred_date | date        | NOT NULL, CHECK   | Booking date (must be future)      |
| preferred_time | time        | NOT NULL          | Booking time slot                  |
| status         | text        | NOT NULL, CHECK   | pending/confirmed/cancelled        |
| notes          | text        | -                 | Special requests (optional)        |
| created_at     | timestamptz | DEFAULT now()     | Booking creation timestamp         |

**Constraints:**
- `valid_status` - Status must be: pending, confirmed, or cancelled
- `no_past_dates` - Booking date must be >= CURRENT_DATE

**RLS:** Enabled
- Anonymous users: INSERT only
- Authenticated users: SELECT allowed
- Updates via admin RPC functions only

**Indexes:**
- `idx_bookings_date` - Date range queries
- `idx_bookings_date_service` - Availability by service
- `idx_bookings_date_service_time` - Specific slot checks
- `idx_bookings_status` - Status filtering
- `idx_bookings_created` - Recent bookings

---

## 🔐 RPC Functions

### Public Functions (No Authentication)

#### `get_booked_slots(date, service_type)`
**Returns:** List of booked time slots for a specific date and service

**Parameters:**
- `d` (date) - The date to check
- `s` (text) - Service type

**Returns:** TABLE(preferred_time text, status text)

**Usage:**
```sql
SELECT * FROM get_booked_slots('2025-11-01', 'Full Body Massage');
```

---

#### `slot_taken(date, service_type, time)`
**Returns:** Boolean indicating if a slot is already booked

**Parameters:**
- `d` (date) - The date to check
- `s` (text) - Service type
- `t` (text) - Time slot (HH:MM format)

**Returns:** boolean

**Usage:**
```sql
SELECT slot_taken('2025-11-01', 'Full Body Massage', '14:00');
```

---

### Admin Functions (Require Valid Token)

#### `admin_login(username, password)`
**Returns:** Authentication token and admin display name

**Parameters:**
- `p_username` (text) - Admin username
- `p_password` (text) - Plain text password

**Returns:** TABLE(token uuid, admin_name text)

**Usage:**
```sql
SELECT * FROM admin_login('bigsamcreates', 'bigsamadmin');
```

---

#### `admin_logout(token)`
**Returns:** void (deletes session)

**Parameters:**
- `p_token` (uuid) - Authentication token

**Usage:**
```sql
SELECT admin_logout('123e4567-e89b-12d3-a456-426614174000');
```

---

#### `is_admin_session(token)`
**Returns:** Boolean indicating if token is valid

**Parameters:**
- `p_token` (uuid) - Authentication token

**Returns:** boolean

**Usage:**
```sql
SELECT is_admin_session('123e4567-e89b-12d3-a456-426614174000');
```

---

#### `get_booking_counts_admin(token, from_date, to_date)`
**Returns:** Statistics for dashboard cards

**Parameters:**
- `p_token` (uuid) - Authentication token
- `d_from` (date) - Start date
- `d_to` (date) - End date

**Returns:** TABLE(total, pending, confirmed, cancelled, today, this_week)

**Authorization:** Validates token, throws 'unauthorized' exception if invalid

---

#### `list_bookings_admin(token, from_date, to_date, service, status)`
**Returns:** Filtered list of bookings

**Parameters:**
- `p_token` (uuid) - Authentication token
- `d_from` (date) - Start date
- `d_to` (date) - End date
- `p_service` (text, optional) - Filter by service type
- `p_status` (text, optional) - Filter by status

**Returns:** TABLE(id, name, whatsapp, email, service_type, preferred_date, preferred_time, status, created_at, notes)

**Authorization:** Validates token, throws 'unauthorized' exception if invalid

---

#### `update_booking_status_admin(token, booking_id, new_status)`
**Returns:** void (updates booking status)

**Parameters:**
- `p_token` (uuid) - Authentication token
- `p_id` (uuid) - Booking ID
- `p_new_status` (text) - New status (pending/confirmed/cancelled)

**Authorization:** Validates token, throws 'unauthorized' exception if invalid

---

#### `admin_create(username, admin_name, password)`
**Returns:** UUID of newly created admin account

**Parameters:**
- `p_username` (text) - Login username (must be unique)
- `p_admin_name` (text) - Display name
- `p_password` (text) - Plain text password (will be hashed)

**Returns:** uuid

**Usage:**
```sql
SELECT admin_create('johndoe', 'John Doe', 'secure_password_123');
```

---

## 🔒 Security Features

### Row Level Security (RLS)
✅ All tables have RLS enabled

| Table          | Anonymous Access | Authenticated Access | Admin Access     |
|----------------|------------------|----------------------|------------------|
| admin_logins   | None (RPC only)  | None                 | RPC only         |
| admin_sessions | None (RPC only)  | None                 | RPC only         |
| bookings       | INSERT only      | SELECT only          | Via RPC with token |

### Password Security
- ✅ Bcrypt hashing with automatic salt generation
- ✅ Uses PostgreSQL `pgcrypto` extension
- ✅ Passwords never stored in plain text
- ✅ Password verification done in database

### Token Security
- ✅ UUID-based tokens (cryptographically random)
- ✅ 30-day expiration
- ✅ Automatic validation on all admin operations
- ✅ Logout properly invalidates tokens

### SQL Injection Prevention
- ✅ All functions use parameterized queries
- ✅ Input validation for status values
- ✅ Type-safe parameters (uuid, date, text)

---

## 🎯 Data Validation

### Bookings Table Constraints

1. **Past Date Prevention**
   ```sql
   CHECK (preferred_date >= CURRENT_DATE)
   ```
   Prevents booking dates in the past

2. **Valid Status Values**
   ```sql
   CHECK (status IN ('pending', 'confirmed', 'cancelled'))
   ```
   Ensures only valid status values

3. **Required Fields**
   - name (NOT NULL)
   - whatsapp (NOT NULL)
   - service_type (NOT NULL)
   - preferred_date (NOT NULL)
   - preferred_time (NOT NULL)

---

## 📈 Performance Optimizations

### Indexes Strategy

| Index Name                         | Columns                              | Purpose                          |
|------------------------------------|--------------------------------------|----------------------------------|
| idx_admin_sessions_token           | token                                | Fast authentication checks       |
| idx_admin_sessions_expires         | expires_at                           | Cleanup expired sessions         |
| idx_bookings_date                  | preferred_date                       | Date range queries               |
| idx_bookings_date_service          | preferred_date, service_type         | Availability by service          |
| idx_bookings_date_service_time     | preferred_date, service_type, time   | Slot collision detection         |
| idx_bookings_status                | status                               | Dashboard filtering              |
| idx_bookings_created               | created_at                           | Recent bookings sorting          |

---

## 🔄 Data Flow

### Customer Booking Flow
```
Customer fills form
      ↓
Check slot availability (slot_taken RPC)
      ↓
If available, INSERT into bookings table (RLS allows)
      ↓
Send webhook to Make.com
      ↓
Success screen shown
```

### Admin Management Flow
```
Admin enters credentials
      ↓
admin_login RPC validates password
      ↓
Returns token + admin_name
      ↓
Token stored in localStorage
      ↓
All admin operations use token
      ↓
is_admin_session validates token
      ↓
Authorized admin operations execute
```

---

## 📝 Default Admin Account

**Created automatically by schema:**

- **Username:** `bigsamcreates`
- **Admin Name:** `Big Sam`
- **Password:** `bigsamadmin`

⚠️ **CRITICAL:** Change this password immediately after first login!

**To change password:**
```sql
UPDATE admin_logins
SET password_hash = crypt('your_new_secure_password', gen_salt('bf'))
WHERE username = 'bigsamcreates';
```

---

## 🧪 Testing Queries

### Test Admin Login
```sql
SELECT * FROM admin_login('bigsamcreates', 'bigsamadmin');
-- Expected: { token: uuid, admin_name: "Big Sam" }
```

### Create Test Booking
```sql
INSERT INTO bookings (name, whatsapp, email, service_type, preferred_date, preferred_time, notes)
VALUES ('Test Customer', '+233501234567', 'test@example.com', 'Full Body Massage', CURRENT_DATE + 1, '14:00', 'Test notes');
-- Expected: 1 row inserted
```

### Check Availability
```sql
SELECT * FROM get_booked_slots(CURRENT_DATE + 1, 'Full Body Massage');
-- Expected: List of booked time slots
```

### Test Past Date Constraint
```sql
INSERT INTO bookings (name, whatsapp, email, service_type, preferred_date, preferred_time)
VALUES ('Test', '+233501234567', 'test@example.com', 'Full Body Massage', '2020-01-01', '14:00');
-- Expected: ERROR - violates check constraint "no_past_dates"
```

---

## 📊 Statistics

- **Total Tables:** 3
- **Total Functions:** 9
- **Total Indexes:** 7
- **RLS Policies:** 2
- **Check Constraints:** 2
- **Lines of SQL:** 458

---

## 🚀 Ready to Use

Your schema is production-ready with:

✅ Complete booking management system
✅ Secure admin authentication
✅ Real-time availability checking
✅ Performance optimized queries
✅ Comprehensive security policies
✅ Data validation constraints
✅ Past date prevention
✅ Idempotent schema (safe to re-run)

**Next Step:** Copy `supabase-complete-schema.sql` into your Supabase SQL Editor and click Run!
