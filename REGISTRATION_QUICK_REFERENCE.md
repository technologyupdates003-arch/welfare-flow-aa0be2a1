# Member Registration System - Quick Reference

## For Admins

### Enable Registration (First Time)
1. Go to **Admin Dashboard → Registration Settings**
2. Toggle "Registration Status" → ON
3. Set "Retiring Date" (e.g., 2027-12-31)
4. Set "Registration Fee" (e.g., 1000)
5. Toggle "Show on Login Page" → ON
6. Click "Save Configuration"

### Manage Registrations
1. Go to **Admin Dashboard → Member Registrations**
2. Filter by "Verified (Payment Confirmed)"
3. Review member details
4. Click ✓ to Approve or ✗ to Reject
5. Member receives SMS with decision

### View API Documentation
1. Go to **Admin Dashboard → Registration API Docs**
2. All 9 endpoints documented with examples
3. Copy curl commands for testing

### Disable Registration Temporarily
1. Go to **Registration Settings**
2. Toggle "Registration Status" → OFF
3. Click "Save"
4. Registration tab disappears from login

---

## For Members (Users)

### Register
1. Go to login page
2. Click "Register" tab
3. Fill in: Name, Phone, Department, Location
4. Click "Continue to Payment"
5. Enter M-Pesa phone number
6. Click "Send Payment Prompt"
7. Complete M-Pesa payment
8. Wait for admin approval SMS

### After Approval
1. Check SMS for system access link
2. Click link from SMS
3. Enter temporary password (from SMS)
4. Complete account setup
5. Start using system

---

## Registration Statuses

| Status | Meaning | What's Next |
|--------|---------|-----------|
| **pending** | Form submitted | Wait for payment |
| **verified** | Payment confirmed | Awaiting admin review |
| **approved** | Admin approved | Receive SMS with system link |
| **rejected** | Admin rejected | Can submit new registration |
| **active** | Account created | Can login normally |

---

## API Quick Reference

### Check if Registration is Active
```bash
curl https://project.supabase.co/functions/v1/member-registration/config
```

### Register Member
```bash
curl -X POST https://project.supabase.co/functions/v1/member-registration/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Doe",
    "phone_number": "0712345678",
    "department": "IT",
    "working_location": "Nairobi"
  }'
```

### Check Registration Status
```bash
curl https://project.supabase.co/functions/v1/member-registration/status/[registration-id]
```

### List Pending Registrations (Admin)
```bash
curl https://project.supabase.co/functions/v1/admin-registration/registrations?status=verified \
  -H "Authorization: Bearer [JWT_TOKEN]"
```

---

## Configuration Constants

| Setting | Default | Range |
|---------|---------|-------|
| Registration Fee | 1000 | 1-999,999 KES |
| Retiring Date | 2027-12-31 | Any future date |
| Payment Timeout | 7 days | Configurable |
| Access Link Expiry | 24 hours | Configurable |
| Retry Limit | 3 attempts | Configurable |

---

## SMS Messages Sent

**To Member After Payment:**
> "Payment verified. Awaiting admin approval. Thank you!"

**To Member After Approval:**
> "Your registration approved! Click: [LINK] | Password: [PASSWORD] | Complete setup immediately."

**To Member After Rejection:**
> "Your registration was rejected. Reason: [REASON]"

---

## Navigation Paths

| Page | URL | Access |
|------|-----|--------|
| Settings | `/admin/registration-settings` | Admin |
| Manage Registrations | `/admin/registration-management` | Admin |
| API Docs | `/admin/registration-api-docs` | Admin |
| Login (with Register tab) | `/` | Public (when enabled) |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Register tab not showing | Check "Show on Login Page" is ON |
| Payment prompt not received | Verify phone format 0712345678, ensure M-Pesa balance |
| Can't see registrations | Filter to "Verified" status, check admin role |
| SMS not received | Check phone number, verify SMS provider balance |
| Member can't access system | Verify link not expired (24 hours), check temporary password |

---

## Key Features

✓ Multi-step form (form → payment → success)
✓ M-Pesa payment integration
✓ Automatic payment verification
✓ Admin approval workflow
✓ SMS notifications at each stage
✓ Temporary passwords for system access
✓ Complete API documentation
✓ Pagination and filtering
✓ Full audit trail in database

---

## Performance Notes

- Registrations paginated: 20 per page
- Approvals/rejections processed instantly
- M-Pesa callback verified within seconds
- SMS delivery: 1-5 minutes
- Database queries optimized with indexes

---

## Security Checklist

✓ All admin operations require JWT + admin role
✓ Phone numbers validated and normalized
✓ M-Pesa credentials never exposed in frontend
✓ Access tokens expire after 24 hours
✓ Passwords stored hashed in database
✓ Row-level security enabled
✓ Rate limiting on payment initiation
✓ CORS restricted to authorized domains

---

**Version:** 1.0
**Last Updated:** 2026-06-09
