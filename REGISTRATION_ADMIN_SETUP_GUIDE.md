# Member Registration System - Admin Setup Guide

## Overview

The Member Registration System is now fully integrated into the welfare application. This guide covers setup, enabling/disabling registration, and managing member registrations through the admin dashboard.

---

## Part 1: Initial Setup

### 1.1 Database Migration
The registration system uses an existing database schema. No new migrations needed.

**Tables created:**
- `registration_config` - Stores registration requirements
- `member_registrations` - Tracks registration attempts
- `registration_fees` - Payment tracking
- `registration_access_links` - System access tokens

### 1.2 Edge Functions
All edge functions are already deployed:
- `/member-registration` - Public API for form submission and payment
- `/member-registration-callback` - M-Pesa payment callback handler
- `/admin-registration` - Admin API for approvals and configuration

### 1.3 Frontend Components
Already created and ready to use:
- `src/components/auth/RegistrationForm.tsx` - Multi-step registration form
- `src/pages/admin/RegistrationSettings.tsx` - Admin configuration panel
- `src/pages/admin/RegistrationManagement.tsx` - Registration review dashboard
- `src/pages/admin/RegistrationApiDocs.tsx` - API documentation

---

## Part 2: Enabling Registration

### 2.1 First-Time Setup

1. **Login to Admin Dashboard**
   - Access the admin panel as a super_admin

2. **Navigate to Settings → Registration Settings**
   - URL: `/admin/registration-settings`

3. **Configure Requirements**
   - Set Retiring Date: Deadline for members to join
   - Set Registration Fee: Amount in KES (e.g., 1000)
   - Toggle "Registration Status" to ON (Green)

4. **Enable Display**
   - Toggle "Show on Login Page" to ON
   - This will make the "Register" tab appear on the login page

5. **Save Configuration**
   - Click "Save Configuration" button
   - Settings are saved to database

### 2.2 Display Settings
- **Show on Login Page**: When enabled, users see "Register" tab on login page
- **Auto Approve**: When enabled, registrations auto-approve (not recommended)
- Display settings save to browser localStorage and apply immediately

---

## Part 3: Member Registration Flow

### For Members (Users)

1. **Visit Login Page**
   - See "Sign In" and "Register" tabs (if enabled)

2. **Click "Register" Tab**
   - Fill in: Full Name, Phone Number, Department, Working Location
   - See registration requirements (retiring date, fee amount)

3. **Click "Continue to Payment"**
   - Review payment summary
   - Enter M-Pesa phone number
   - Click "Send Payment Prompt"

4. **Complete M-Pesa Payment**
   - Receive M-Pesa STK Push prompt on phone
   - Enter M-Pesa PIN
   - Payment is verified automatically

5. **Await Admin Approval**
   - Receive SMS: "Payment verified. Awaiting admin approval"
   - Admin reviews and approves/rejects
   - On approval: Receive SMS with system access link + temporary password

6. **Access System**
   - Click link in SMS
   - Enter temporary password
   - Complete account setup

---

## Part 4: Admin Registration Management

### 4.1 View Registrations

1. **Navigate to Admin → Registration Management**
   - URL: `/admin/registration-management`
   - Shows all registrations with status

2. **Filter by Status**
   - Verified (Payment Confirmed) - Ready for approval/rejection
   - Pending - Not yet paid
   - Approved - Already approved
   - Rejected - Already rejected
   - All - Show all registrations

3. **View Registration Details**
   - Click Eye icon to view full details
   - Shows: Name, Phone, Department, Location, Status, Dates

### 4.2 Approve Registration

1. **Select Status Filter: "Verified"**
   - Shows only registrations with confirmed payment

2. **Click Green Checkmark Button**
   - Opens approval dialog

3. **Add Optional Notes**
   - Any notes about the approval

4. **Click "Approve"**
   - System link + temporary password generated
   - SMS sent to member with access details
   - Status changes to "Approved"

### 4.3 Reject Registration

1. **Click Red X Button**
   - Opens rejection dialog

2. **Provide Rejection Reason**
   - Must explain why registration is rejected

3. **Click "Reject"**
   - SMS sent to member with rejection reason
   - Status changes to "Rejected"

### 4.4 View API Documentation

1. **Navigate to Admin → Registration API Docs**
   - URL: `/admin/registration-api-docs`
   - Complete API reference with examples
   - All endpoints documented with curl examples

---

## Part 5: Disabling Registration

### 5.1 Temporarily Disable

1. **Go to Settings → Registration Settings**
2. **Toggle "Registration Status" to OFF** (Red)
3. **Save Configuration**
   - Registration tab disappears from login page
   - Existing registrations can still be managed

### 5.2 Disable Display Only

1. **Go to Settings → Registration Settings**
2. **Toggle "Show on Login Page" to OFF**
3. Settings auto-save
   - Registration tab hidden but system still accepts registrations via API

---

## Part 6: Configuration Reference

### Registration Config Table

| Field | Example | Description |
|-------|---------|-------------|
| retiring_date | 2027-12-31 | Deadline to join |
| registration_fee | 1000 | Fee in KES |
| active | true | Enable/disable registration |

### Registration Status Values

| Status | Description |
|--------|-------------|
| pending | Form submitted, awaiting payment |
| payment_pending | Waiting for M-Pesa payment |
| verified | Payment confirmed |
| approved | Admin approved, access link sent |
| rejected | Admin rejected |
| active | Member system access completed |

### Payment Status Values

| Status | Description |
|--------|-------------|
| pending | Payment not yet initiated |
| unpaid | STK Push sent, awaiting payment |
| paid | Payment received |
| verified | Payment verified |
| failed | Payment failed, can retry |

---

## Part 7: Troubleshooting

### Registration Tab Not Appearing

**Solution:**
1. Check "Show on Login Page" setting in Registration Settings
2. Clear browser cache (Ctrl+Shift+Delete)
3. Reload login page
4. Verify registration_enabled setting in localStorage:
   - Open DevTools → Application → LocalStorage
   - Find key: `registration_display_settings`
   - Ensure `"show_on_login": true`

### Payment Prompt Not Received

**For Member:**
1. Check phone number format (0712345678)
2. Ensure M-Pesa account has enough balance
3. Wait 30 seconds and try again
4. Contact admin if issue persists

**Admin Response:**
1. Check registration_fees table for failures
2. User can start new registration
3. Previous registrations show in rejected list

### Registration Not Approving

**Solution:**
1. Check registration status is "verified"
2. Verify admin has correct JWT token
3. Check browser console for API errors
4. Ensure admin role has "admin" or "super_admin" privilege

### M-Pesa Callback Not Processing

**Solution:**
1. Verify M-Pesa credentials are correct in edge function env
2. Check callback endpoint is publicly accessible
3. Review M-Pesa webhook configuration
4. Check registration_fees table for payment records

---

## Part 8: API Integration

### For Developers

**Public Endpoints** (no auth required):
- `GET /member-registration/config` - Get registration requirements
- `POST /member-registration/register` - Submit registration form
- `POST /member-registration/initiate-payment` - Start payment
- `GET /member-registration/status/{id}` - Check status

**Admin Endpoints** (requires JWT with admin role):
- `GET /admin-registration/registrations` - List registrations
- `GET /admin-registration/registrations/{id}` - Get details
- `POST /admin-registration/registrations/{id}/approve` - Approve
- `POST /admin-registration/registrations/{id}/reject` - Reject
- `GET /admin-registration/config` - Get configuration
- `PUT /admin-registration/config` - Update configuration

See **Registration API Docs** in admin dashboard for full documentation.

---

## Part 9: SMS Templates

### Sent to Member After Payment

**Success:**
"Payment verified. Awaiting admin approval. Thank you!"

### Sent After Admin Approval

"Your registration approved! Click: [LINK] | Password: [TEMP_PASSWORD] | Complete setup immediately. Link expires in 24 hours."

### Sent After Admin Rejection

"Your registration was rejected. Reason: [REASON]. Contact admin for more information."

---

## Part 10: Security Considerations

### Row-Level Security (RLS)

- Members can only see their own registrations
- Admins can see all registrations
- Payment data is protected
- Access tokens expire after 24 hours

### Authentication

- All admin operations require valid JWT token
- Token obtained during login
- Tokens include user role verification
- M-Pesa credentials stored securely in Edge Function environment

### Data Privacy

- Phone numbers normalized and stored securely
- Payment details don't include full card info
- Only M-Pesa receipt numbers stored
- Personal data encrypted at rest

---

## Part 11: Monitoring

### Check Registration Activity

**Dashboard Shows:**
- Total registrations by status
- Payment success rate
- Admin approval rate
- Timeline of registrations

### Common Metrics

1. **Pending Registrations**: Awaiting payment
2. **Verified Registrations**: Ready for admin review
3. **Approval Rate**: Approved vs Rejected
4. **Average Approval Time**: Time from payment to approval

---

## Support

For issues or questions:
1. Check Registration API Docs page
2. Review this setup guide
3. Contact system admin with error details
4. Provide registration ID if applicable

---

**Last Updated:** 2026-06-09
**Version:** 1.0
