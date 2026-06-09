# Member Registration API - Implementation Guide

## 📋 Overview

This document provides step-by-step instructions to deploy and integrate the new member registration system with payment verification and SMS notifications.

## 🚀 Deployment Steps

### Step 1: Deploy Database Migration

1. Apply the database migration to create the new tables:
```bash
# Using Supabase CLI
supabase migration up 20260609000001_member_registration_schema

# Or manually run the SQL in Supabase console
# Path: supabase/migrations/20260609000001_member_registration_schema.sql
```

2. Verify tables were created:
```sql
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('registration_config', 'member_registrations', 'registration_fees', 'registration_access_links');
```

### Step 2: Deploy Supabase Functions

Deploy the three edge functions:

```bash
# Deploy member registration API
supabase functions deploy member-registration

# Deploy payment callback handler
supabase functions deploy member-registration-callback

# Deploy admin registration management
supabase functions deploy admin-registration
```

### Step 3: Set Environment Variables

Configure these secrets in your Supabase project:

```
# M-Pesa Configuration (should already exist)
MPESA_CONSUMER_KEY=your_daraja_consumer_key
MPESA_CONSUMER_SECRET=your_daraja_consumer_secret
MPESA_SHORTCODE=174379  # or your production shortcode
MPESA_PASSKEY=your_passkey
MPESA_BASE_URL=https://sandbox.safaricom.co.ke  # for testing

# System Configuration
SYSTEM_URL=https://your-system-domain.com  # Where members access main system
WEBSITE_URL=https://your-website-domain.com  # Registration website domain

# SMS Configuration (should already exist)
SMS_API_KEY=your_sms_api_key
SMS_API_URL=your_sms_api_url
```

### Step 4: Update RLS Policies (if needed)

The migration creates RLS policies automatically. If you need to adjust permissions:

```sql
-- Example: Allow public read on registration_config
CREATE POLICY "Allow public read registration_config"
ON registration_config FOR SELECT
USING (true);
```

## 📝 API Reference

### 1. Website Member Registration

#### Get Registration Configuration
```bash
curl -X GET \
  https://your-project.supabase.co/functions/v1/member-registration/config
```

**Response:**
```json
{
  "success": true,
  "data": {
    "retiring_date": "2027-12-31",
    "registration_fee": 1000,
    "active": true,
    "message": "Join our welfare group"
  }
}
```

#### Submit Registration
```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/member-registration/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Doe",
    "phone_number": "0712345678",
    "department": "IT",
    "working_location": "Nairobi",
    "date_of_birth": "1980-01-15"
  }'
```

**Response:**
```json
{
  "success": true,
  "registration_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "payment_pending",
  "registration_fee": 1000,
  "message": "Please complete M-Pesa payment",
  "next_step": "initiate_payment"
}
```

#### Initiate Payment
```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/member-registration/initiate-payment \
  -H "Content-Type: application/json" \
  -d '{
    "registration_id": "550e8400-e29b-41d4-a716-446655440000",
    "phone_number": "0712345678"
  }'
```

**Response:**
```json
{
  "success": true,
  "checkout_request_id": "ws_CO_DMZ3BK9QR60",
  "message": "Payment prompt sent to 0712345678. Enter your M-Pesa PIN."
}
```

#### Check Registration Status
```bash
curl -X GET \
  https://your-project.supabase.co/functions/v1/member-registration/status/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "success": true,
  "registration_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "verified",
  "payment_status": "verified",
  "created_at": "2026-06-09T10:00:00Z",
  "verified_at": "2026-06-09T10:05:00Z",
  "message": "Your registration is verified. Awaiting admin approval."
}
```

### 2. Admin Management APIs

All admin endpoints require Bearer token authentication:
```
Authorization: Bearer <user_jwt_token>
```

#### List All Registrations
```bash
curl -X GET \
  "https://your-project.supabase.co/functions/v1/admin-registration/registrations?status=verified&page=1" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Query Parameters:**
- `status`: Filter by status (pending, payment_pending, verified, approved, rejected)
- `page`: Page number (default: 1)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "full_name": "John Doe",
      "phone_number": "254712345678",
      "department": "IT",
      "working_location": "Nairobi",
      "status": "verified",
      "payment_status": "verified",
      "created_at": "2026-06-09T10:00:00Z",
      "verified_at": "2026-06-09T10:05:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### Get Registration Details
```bash
curl -X GET \
  https://your-project.supabase.co/functions/v1/admin-registration/registrations/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $JWT_TOKEN"
```

#### Approve Registration
```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/admin-registration/registrations/550e8400-e29b-41d4-a716-446655440000/approve \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Approved - meets all requirements"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Registration approved and SMS sent",
  "data": {
    "registration_id": "550e8400-e29b-41d4-a716-446655440000",
    "system_link": "https://system.domain/register/token-here",
    "temporary_password": "TEMP_PASSWORD_123"
  }
}
```

#### Reject Registration
```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/admin-registration/registrations/550e8400-e29b-41d4-a716-446655440000/reject \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Does not meet retiring date requirement"
  }'
```

#### Get Registration Configuration
```bash
curl -X GET \
  https://your-project.supabase.co/functions/v1/admin-registration/config \
  -H "Authorization: Bearer $JWT_TOKEN"
```

#### Update Registration Configuration
```bash
curl -X PUT \
  https://your-project.supabase.co/functions/v1/admin-registration/config \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "retiring_date": "2028-12-31",
    "registration_fee": 1500,
    "active": true
  }'
```

## 🎨 Frontend Integration

### Using the Registration Library

```typescript
import {
  getRegistrationConfig,
  submitRegistration,
  initiateRegistrationPayment,
  checkRegistrationStatus,
  validatePhoneNumber,
  formatPhoneNumber,
} from "@/lib/member-registration";

// Get current requirements
const config = await getRegistrationConfig();
console.log(`Fee: KES ${config.registration_fee}`);
console.log(`Deadline: ${config.retiring_date}`);

// Submit registration
const response = await submitRegistration({
  full_name: "John Doe",
  phone_number: "0712345678",
  department: "IT",
  working_location: "Nairobi",
});

if (response.success) {
  const registrationId = response.registration_id;
  
  // Initiate payment
  const paymentResult = await initiateRegistrationPayment(
    registrationId,
    "0712345678"
  );
  
  // Check status
  const status = await checkRegistrationStatus(registrationId);
}
```

## 🔐 Security Considerations

1. **Phone Number Validation**: Always validate phone format before sending to API
2. **Rate Limiting**: Implement rate limiting (5 registrations per hour per IP)
3. **Payment Verification**: All payments verified via M-Pesa callback
4. **SMS Security**: Never expose system links in public URLs
5. **Temporary Passwords**: Valid for 24 hours only
6. **Admin Authentication**: All admin endpoints require JWT token with admin role

## 📱 SMS Templates

### Payment Verification SMS
```
Asante [NAME]! Malipo yako yamethibitishwa. Utapata ujumbe wa kuingia kwenye mfumo hivi karibuni.
```

### System Access SMS (After Admin Approval)
```
Karibu kwenye jamii yetu! Ingia kwenye mfumo:
[SYSTEM_LINK]

Neno la siri: [TEMP_PASSWORD]
Badilisha neno lako baada ya kuingia kwenye mfumo.
```

### Rejection SMS
```
Asante kwa kamatia! Ombi lako halijalipulikana: [REASON]. Jaribu tena baadaye.
```

## 🧪 Testing

### Test Payment Flow
1. Submit registration with test data
2. Initiate M-Pesa payment
3. Complete payment in M-Pesa sandbox
4. Verify payment callback is processed
5. Check registration status updates to "verified"

### Test Admin Approval
1. Approve a verified registration
2. Check that SMS was sent with system link
3. Verify registration status changes to "approved"

## 🔧 Troubleshooting

### Payment Not Going Through
- Check M-Pesa credentials in environment
- Verify phone number format (should be 254712345678)
- Check Daraja token generation
- Review server logs for callback errors

### SMS Not Sending
- Verify SMS API credentials
- Check phone number is in correct format
- Ensure SMS provider has available balance

### Registration Expired
- Registrations expire after 7 days
- User must submit new registration after expiration

## 📊 Database Queries

### View All Registrations
```sql
SELECT * FROM member_registrations ORDER BY created_at DESC;
```

### View Registrations by Status
```sql
SELECT * FROM member_registrations WHERE status = 'verified' AND payment_status = 'verified';
```

### View Payment Records
```sql
SELECT r.full_name, rf.amount, rf.status, rf.created_at, rf.verified_at
FROM registration_fees rf
JOIN member_registrations r ON rf.registration_id = r.id
ORDER BY rf.created_at DESC;
```

### View Access Links
```sql
SELECT r.full_name, ral.access_token, ral.created_at, ral.expires_at, ral.used
FROM registration_access_links ral
JOIN member_registrations r ON ral.registration_id = r.id
ORDER BY ral.created_at DESC;
```

## 📞 Support

For API issues or questions, refer to:
- NEW_MEMBER_REGISTRATION_API.md - API specification
- Database migration file - Schema details
- Edge function code - Implementation details
