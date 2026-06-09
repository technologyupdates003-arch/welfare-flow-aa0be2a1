# Member Registration System - Complete Flow Guide

## 🎯 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PUBLIC WEBSITE (website.com)                 │
├─────────────────────────────────────────────────────────────────┤
│  1. New Member Visits Registration Form                         │
│  2. Fills Form: Name, Phone, Department, Location              │
│  3. System Checks Requirements (Retiring Date)                 │
│  4. Initiates M-Pesa STK Push Payment                          │
│  5. Member Completes Payment                                    │
│  6. Payment Verified via Callback                              │
│  7. SMS Sent: "Payment verified, awaiting approval"            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND - SUPABASE                             │
├─────────────────────────────────────────────────────────────────┤
│  • member_registrations table                                    │
│  • registration_fees table                                       │
│  • registration_access_links table                              │
│  • registration_config table                                    │
│                                                                  │
│  Edge Functions:                                                 │
│  • member-registration (register, init payment, status)         │
│  • member-registration-callback (M-Pesa callback)              │
│  • admin-registration (approve, reject, config)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               ADMIN DASHBOARD (system.com/admin)                │
├─────────────────────────────────────────────────────────────────┤
│  1. Admin Views List of Verified Registrations                 │
│  2. Checks Requirements (Retiring Date, Payment)               │
│  3. Approves or Rejects Application                            │
│  4. System Generates System Access Link                        │
│  5. SMS Sent to Member with System Link + Temp Password       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              MEMBER SYSTEM (system.com/register)                │
├─────────────────────────────────────────────────────────────────┤
│  1. Member Clicks SMS Link                                     │
│  2. Uses Temp Password to Login                                │
│  3. Changes Password on First Login                            │
│  4. Account Becomes Active                                     │
│  5. Member Can Access Dashboard                               │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 Step-by-Step Workflows

### A. NEW MEMBER REGISTRATION FLOW

#### Phase 1: Website Registration (Member Action)

```
Step 1: Visit Registration Page
├─ Website shows: "Join Our Welfare Group"
├─ Display: Retiring Date, Registration Fee
└─ Display: Form Fields

Step 2: Complete Registration Form
├─ Full Name: [John Doe]
├─ Phone: [0712345678]
├─ Department: [IT]
├─ Working Location: [Nairobi]
└─ Date of Birth: [Optional]

Step 3: Check Requirements
├─ Verify: Phone number format ✓
├─ Verify: Name length ✓
├─ Verify: Not registered today ✓
└─ Verify: Meets retiring date ✓

Step 4: Submit Registration
├─ API: POST /member-registration/register
├─ Response: Registration ID + Status "payment_pending"
└─ Display: Payment Instructions
```

**Frontend Code Example:**
```typescript
// Get config
const config = await getRegistrationConfig();

// Submit registration
const result = await submitRegistration({
  full_name: "John Doe",
  phone_number: "0712345678",
  department: "IT",
  working_location: "Nairobi"
});

if (result.success) {
  // Show: "Click to proceed with payment"
  // Display: registration_id for reference
}
```

#### Phase 2: Payment (Member Action)

```
Step 1: Initiate Payment
├─ Display: Registration Fee "KES 1000"
├─ Input: Confirm Phone Number
└─ Button: "Pay via M-Pesa"

Step 2: STK Push to Phone
├─ API: POST /member-registration/initiate-payment
├─ Daraja: Send STK Push
├─ Phone: M-Pesa prompt appears
└─ Message: "Enter M-Pesa PIN"

Step 3: Member Enters PIN
├─ Phone: "Processing..."
├─ M-Pesa: Verifies payment
└─ M-Pesa: Sends callback to backend

Step 4: Payment Callback
├─ API: POST /member-registration-callback
├─ Check: Result Code = 0 (Success)
├─ Update: registration_fees status = "paid"
├─ Update: member_registrations status = "verified"
└─ Send: SMS "Payment verified"
```

**M-Pesa Success Response:**
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "...",
      "CheckoutRequestID": "ws_CO_DMZ3BK9QR60",
      "ResultCode": 0,
      "ResultDesc": "The service request has been processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {"Name": "Amount", "Value": 1000},
          {"Name": "MpesaReceiptNumber", "Value": "SJ5J3J4J2J1"},
          {"Name": "TransactionDate", "Value": "20260609102030"},
          {"Name": "PhoneNumber", "Value": "254712345678"}
        ]
      }
    }
  }
}
```

#### Phase 3: Waiting for Admin (System Auto)

```
Status Changes:
├─ payment_pending → verified ✓
├─ Member receives SMS: "Your payment verified. Awaiting approval."
└─ Registration appears in Admin Dashboard

Timeout:
├─ If no admin action for 7 days
└─ Registration expires (must re-register)
```

### B. ADMIN APPROVAL FLOW

#### Phase 1: Review Registrations (Admin Action)

```
Step 1: Admin Login
├─ Domain: system.com/admin
├─ Navigate: Dashboard → Member Registrations
└─ Display: "Verified Registrations Pending Approval"

Step 2: View Registrations List
├─ Filter: By Status (Verified, Approved, Rejected)
├─ Sort: By Date (Newest First)
├─ Display: Name, Phone, Department, Location, Payment Status
└─ Action Buttons: Approve / Reject / View Details

Step 3: Check Registration Details
├─ Click: Individual Registration
├─ Display: Full info + Payment proof
├─ Check: Meets all requirements
│   ├─ ✓ Paid registration fee
│   ├─ ✓ Meets retiring date
│   └─ ✓ All fields completed
└─ Decision: Approve or Reject
```

**Admin Dashboard Query:**
```bash
curl -X GET \
  "https://project.supabase.co/functions/v1/admin-registration/registrations?status=verified" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

#### Phase 2: Approval (Admin Action)

```
Step 1: Admin Approves Registration
├─ Click: "Approve" Button
├─ Optional: Add approval notes
└─ Click: "Confirm"

Step 2: System Processes Approval
├─ API: POST /admin-registration/registrations/{id}/approve
├─ Generate: Access token (JWT-like)
├─ Generate: Temporary password (e.g., "TEMP_PASS_123")
├─ Create: registration_access_links record
├─ Update: registration status = "approved"
└─ Prepare: SMS with system link

Step 3: Send System Access SMS
├─ Message Template:
│  "Karibu kwenye jamii! Ingia kwenye mfumo:
│   https://system.com/register/[TOKEN]
│   Neno la siri: TEMP_PASS_123
│   Badilisha neno lako baada ya kuingia"
├─ Send: via SMS provider
└─ Display: "Approval sent. SMS notification delivered."

Step 4: Admin Dashboard Update
├─ Registration moves to "Approved" section
├─ Show: System link used (timestamp)
└─ Show: Member access status
```

**Approval API Call:**
```bash
curl -X POST \
  "https://project.supabase.co/functions/v1/admin-registration/registrations/550e8400/approve" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "All requirements met"}'
```

#### Phase 3: Rejection (Optional)

```
Step 1: Admin Reviews & Decides to Reject
├─ Reason Examples:
│  ├─ "Does not meet retiring date requirement"
│  ├─ "Duplicate registration"
│  └─ "Incomplete information"

Step 2: Admin Submits Rejection
├─ Click: "Reject" Button
├─ Enter: Rejection reason
└─ Click: "Confirm Rejection"

Step 3: System Processes Rejection
├─ API: POST /admin-registration/registrations/{id}/reject
├─ Update: registration status = "rejected"
├─ Prepare: Rejection SMS
└─ Send: SMS to member

Step 4: Member Notification
├─ SMS: "Asante kwa kamatia! Ombi halijalipulikana: [REASON]. 
│         Jaribu tena baadaye."
└─ Member can submit new registration
```

### C. MEMBER SYSTEM ACCESS FLOW

#### Phase 1: Member Receives SMS

```
SMS Content:
┌──────────────────────────────────────────┐
│ Karibu kwenye jamii yetu!                │
│ Ingia kwenye mfumo:                      │
│ https://system.com/register/[TOKEN]      │
│                                           │
│ Neno la siri: TEMP_PASSWORD_123          │
│ Badilisha neno lako baada ya kuingia     │
└──────────────────────────────────────────┘

Member Actions:
├─ Click SMS Link OR
├─ Visit system.com/register/[TOKEN]
└─ Browser opens registration page
```

#### Phase 2: First Login

```
Step 1: System Validates Link
├─ Check: Access token exists
├─ Check: Not already used
├─ Check: Not expired (24 hours)
└─ Show: Login form with temp password pre-filled

Step 2: Member Logs In
├─ Phone/Email: [From registration]
├─ Password: [Temporary password from SMS]
└─ Click: "Login"

Step 3: System Validates Credentials
├─ Check: Phone matches registration
├─ Check: Password matches temp password
└─ Check: First time access = true

Step 4: Force Password Change
├─ Show: "Change Your Password" form
├─ Fields:
│  ├─ Current Password: [TEMP_PASSWORD_123] ✓ (auto-filled)
│  ├─ New Password: [____________________]
│  └─ Confirm Password: [____________________]
├─ Member enters new password
└─ Click: "Update Password"

Step 5: Create Member Account
├─ Mark: Access link as used
├─ Create: Member account with new password
├─ Set: Account status = "active"
├─ Generate: Member ID
└─ Redirect: Dashboard
```

#### Phase 3: Member Dashboard Access

```
Step 1: Logged In Successfully
├─ Redirect: Member Dashboard
├─ Display: Welcome message with name
└─ Show: Available features

Step 2: Member Can Access
├─ Profile information
├─ Payment history
├─ Contributions
├─ Downloads
├─ And all other member features
```

## 🔄 Status Transitions

```
Registration Status Flow:
pending
   ↓
payment_pending (after initiate payment)
   ↓
verified (after payment callback)
   ↓
├─ approved (admin approves)
│   ↓
│  active (member logs in and changes password)
│
└─ rejected (admin rejects)
    ↓
  (member must re-register)
```

## ⏰ Timeline

```
Day 1:
├─ 10:00 AM - Member submits registration
├─ 10:02 AM - M-Pesa payment prompt sent
├─ 10:03 AM - Member completes payment
├─ 10:04 AM - Payment verified, SMS sent
└─ Status: "Awaiting Admin Approval"

Day 2:
├─ 09:00 AM - Admin reviews registration
├─ 09:05 AM - Admin approves
├─ 09:05 AM - SMS sent with system link
├─ 09:06 AM - Member receives SMS
└─ Status: "Approved"

Day 2:
├─ 09:10 AM - Member clicks SMS link
├─ 09:11 AM - Logs in with temp password
├─ 09:12 AM - Changes password
└─ Status: "Active Member"
```

## 📊 Data Flow Summary

```
Data Collection:
├─ member_registrations: Basic info + status
├─ registration_fees: Payment details
├─ registration_access_links: System access tokens
└─ registration_config: Admin settings

Payment Flow:
├─ STK Push initiated → Daraja API
├─ Callback received → Process payment
├─ Update registrations & fees
└─ Send SMS notification

Approval Flow:
├─ Admin review → Database update
├─ Generate access link & password
├─ Create access_links record
├─ Send SMS via SMS provider
└─ Mark link as used when accessed

Member Access:
├─ Click link → Validate token
├─ Login with temp password
├─ Force password change
├─ Create member account
└─ Member active in system
```

## 🚨 Important Notes

1. **Registration Expires**: After 7 days with no admin action
2. **Access Link Valid**: For 24 hours after approval
3. **Temporary Password**: Must be changed on first login
4. **Payment Verification**: All payments verified via M-Pesa callback
5. **Admin Only**: Only users with "admin" or "super_admin" role can approve
6. **Two Domains**: Website registration separate from main system
7. **SMS Gateway**: Uses existing SMS integration
8. **M-Pesa Integration**: Uses existing Daraja configuration

## ✅ Checklist for Deployment

- [ ] Deploy database migration
- [ ] Deploy three edge functions
- [ ] Set M-Pesa environment variables
- [ ] Set system URL in environment
- [ ] Test registration flow with test phone
- [ ] Test payment flow in M-Pesa sandbox
- [ ] Test admin approval flow
- [ ] Test SMS delivery
- [ ] Create admin dashboard UI
- [ ] Create website registration form
- [ ] Configure domains and DNS
- [ ] Train admins on approval process
- [ ] Communicate to members
