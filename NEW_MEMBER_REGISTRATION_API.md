# New Member Registration API - Implementation Plan

## Overview
Two-domain system where:
- **Website (Public Domain)**: New member registration with payment
- **System (Internal Domain)**: Admin management and member dashboards

## Registration Requirements
1. **Retiring Date**: Admin-configured (can't join if don't meet deadline)
2. **Registration Fee**: STK Push payment (goes to operations wallet)
3. **Department**: Member's working department
4. **Full Name**: First and Last name
5. **Phone Number**: For payment and SMS
6. **Working Location**: Member's location

## Database Tables

### 1. `registration_config` (Admin Settings)
```sql
- id (uuid)
- retiring_date (date) - Deadline to join
- registration_fee (integer) - KES amount
- active (boolean)
- updated_at (timestamp)
- updated_by (uuid) - Admin user
```

### 2. `member_registrations` (Pending/Active Registrations)
```sql
- id (uuid)
- full_name (text)
- phone_number (text)
- department (text)
- working_location (text)
- status (enum: 'pending', 'payment_pending', 'verified', 'rejected')
- payment_status (enum: 'unpaid', 'paid', 'verified')
- mpesa_transaction_ref (text)
- created_at (timestamp)
- verified_at (timestamp)
- expires_at (timestamp) - 7 days from creation
- notes (text)
```

### 3. `registration_fees` (Payment Tracking)
```sql
- id (uuid)
- registration_id (uuid) - FK to member_registrations
- amount (integer)
- phone_number (text)
- mpesa_transaction_id (text)
- status (enum: 'pending', 'paid', 'failed')
- created_at (timestamp)
- verified_at (timestamp)
- retry_count (integer)
```

## API Endpoints

### 1. Website Public APIs

#### GET `/api/v1/registration/config`
Get current registration requirements
```json
Response:
{
  "retiring_date": "2026-12-31",
  "registration_fee": 1000,
  "active": true,
  "message": "Join our welfare group"
}
```

#### POST `/api/v1/registration/register`
Submit new member registration
```json
Request:
{
  "full_name": "John Doe",
  "phone_number": "0712345678",
  "department": "IT",
  "working_location": "Nairobi",
  "date_of_birth": "1980-01-15"
}

Response:
{
  "registration_id": "uuid",
  "status": "payment_pending",
  "registration_fee": 1000,
  "checkout_request_id": "123456", // For checking payment status
  "message": "Please complete M-Pesa payment"
}
```

#### POST `/api/v1/registration/initiate-payment`
Start STK Push for registration fee
```json
Request:
{
  "registration_id": "uuid",
  "phone_number": "0712345678"
}

Response:
{
  "success": true,
  "checkout_request_id": "123456",
  "message": "Payment prompt sent to your phone"
}
```

#### GET `/api/v1/registration/{registration_id}/status`
Check registration status
```json
Response:
{
  "registration_id": "uuid",
  "status": "verified",
  "payment_status": "paid",
  "message": "You will receive SMS with system access link shortly"
}
```

### 2. Admin APIs (Internal Domain)

#### GET `/api/v1/admin/registration-config`
Get current config
```json
Response: { same as above }
```

#### PUT `/api/v1/admin/registration-config`
Update registration requirements
```json
Request:
{
  "retiring_date": "2027-12-31",
  "registration_fee": 1500,
  "active": true
}
```

#### GET `/api/v1/admin/registrations`
List all registrations with filters
```json
Response:
{
  "registrations": [
    {
      "id": "uuid",
      "full_name": "John Doe",
      "phone_number": "0712345678",
      "status": "verified",
      "payment_status": "paid",
      "created_at": "2026-06-09T10:00:00Z"
    }
  ],
  "total": 100,
  "page": 1
}
```

#### POST `/api/v1/admin/registrations/{id}/approve`
Approve a registration and send system access SMS
```json
Request:
{
  "notes": "Approved - meets all requirements"
}

Response:
{
  "success": true,
  "message": "SMS sent with system access link",
  "system_link": "https://system.domain/register/uuid",
  "temporary_password": "TEMP_PASSWORD_123"
}
```

#### POST `/api/v1/admin/registrations/{id}/reject`
Reject registration
```json
Request:
{
  "reason": "Does not meet retiring date requirement"
}
```

## Process Flow

### Step 1: Member on Website
1. View registration form with current requirements
2. Fill form (name, phone, department, location)
3. Click "Pay Registration Fee"

### Step 2: Payment
1. System calls STK Push API with registration fee
2. M-Pesa prompt sent to member's phone
3. Member enters PIN
4. Payment verified via callback

### Step 3: Pending Verification
1. Registration status = "verified" (payment confirmed)
2. SMS sent to member: "Your registration is under review. You'll receive system access link soon."
3. Admin reviews registrations

### Step 4: Admin Approval
1. Admin checks: meets retiring date, paid fee
2. Admin approves registration
3. System generates system link + temporary password
4. SMS sent: "Welcome! Access system: [link] | Password: [temp_password]"

### Step 5: System Access
1. Member clicks SMS link or visits system domain
2. Logs in with phone + temporary password
3. Must change password on first login
4. Account created as new member

## SMS Templates

### Registration Fee Payment Prompt
```
"Karibu! Endelea na mujibu wa kama ahadi ya biashara - KES {amount}. 
Utapata ujumbe wa kufungua akaunti baada ya malipo."
```

### After Payment Verification
```
"Karibu! Malipo yako yamethibitishwa. Utapata ujumbe wa kuingia kwenye mfumo hivi karibuni."
```

### System Access (After Admin Approval)
```
"Karibu kwenye jamii yetu! Ingia kwenye mfumo:
{link}
Neno la siri: {temp_password}
Badilisha neno lako baada ya kuingia."
```

## Security Considerations
1. Registration expires after 7 days if not verified
2. Temporary password valid for 24 hours
3. Rate limit registration: 5 per hour per IP
4. Validate phone number format
5. SMS with system link contains JWT token valid for 7 days
6. Admin must approve before system access

## Implementation Order
1. Create database tables and RLS policies
2. Create admin config endpoints
3. Create registration endpoints
4. Create payment verification logic
5. Create SMS sending logic
6. Create admin dashboard for approvals
7. Create website registration form
8. Test complete flow
