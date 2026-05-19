# Member Funds Drive Access Fix

## Problem
Members cannot see or contribute to funds drives created by admins. The page shows "No active funds drives" even when campaigns exist.

## Root Cause
The `donation_campaigns` table has Row Level Security (RLS) enabled, but there's no policy allowing regular members to read active campaigns. Only admins can see all campaigns.

## Solution

### Step 1: Update RLS Policies in Supabase

Run the following SQL in your Supabase SQL Editor:

```sql
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Members can view active campaigns" ON public.donation_campaigns;
DROP POLICY IF EXISTS "Anyone authenticated can view active campaigns" ON public.donation_campaigns;

-- Create new policy allowing authenticated users to view active campaigns
CREATE POLICY "Members can view active campaigns"
ON public.donation_campaigns FOR SELECT
TO authenticated
USING (active = true);

-- Ensure admin/super_admin can view all campaigns
DROP POLICY IF EXISTS "Admin can view all campaigns" ON public.donation_campaigns;
CREATE POLICY "Admin can view all campaigns"
ON public.donation_campaigns FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);
```

### Step 2: Code Changes Made

#### 1. **Donate.tsx** - Added error handling and logging
- Added try-catch block to handle RLS errors
- Added console logging to debug campaign fetching
- Added error toast notifications
- Changed "Donation Wallet" to "Funds Drive"
- Changed "Donate" button to "Contribute"

#### 2. **DonationCampaigns.tsx** - Updated terminology
- Changed "Donation Campaigns" to "Funds Drives"
- Changed "Donation Wallet" to "Funds Wallet"
- Updated all form labels and descriptions

#### 3. **MemberLayout.tsx** - Updated navigation
- Changed "Donate" link to "Contribute"

#### 4. **AdminLayout.tsx** - Updated navigation
- Changed "Donation Wallet" to "Funds Wallet"
- Changed "Donation Campaigns" to "Funds Drives"

#### 5. **TreasurerLayout.tsx** - Updated navigation
- Changed "Donation Wallet" to "Funds Wallet"

#### 6. **DonationWallet.tsx** - Updated titles
- Changed "Donation Wallet" to "Funds Wallet"
- Updated dialog titles and descriptions

## Testing Checklist

### Admin Testing
- [ ] Log in as admin
- [ ] Go to "Funds Drives" (formerly "Donation Campaigns")
- [ ] Create a new funds drive with:
  - Title: "Building Fund 2026"
  - Description: "Help us build a new community center"
  - Amount: 50000
  - Active: Yes
- [ ] Verify the funds drive appears in the list

### Member Testing
- [ ] Log in as a regular member (no admin role)
- [ ] Click "Contribute" in the sidebar
- [ ] Verify the funds drive created by admin appears
- [ ] Select the funds drive
- [ ] Enter M-Pesa phone number
- [ ] Click "Contribute KES 50,000"
- [ ] Verify the STK push prompt is sent

### Error Handling
- [ ] Check browser console for any errors
- [ ] Verify error messages appear if RLS policies are not set
- [ ] Confirm toast notifications show appropriate messages

## If Members Still Can't See Funds Drives

### Check 1: Verify RLS Policies
Go to Supabase Dashboard → Authentication → Policies → donation_campaigns table

You should see:
- "Members can view active campaigns" - SELECT policy for authenticated users
- "Admin can view all campaigns" - SELECT policy for admin/super_admin

### Check 2: Verify Active Status
In Supabase Dashboard → SQL Editor, run:
```sql
SELECT id, title, active FROM public.donation_campaigns;
```

Ensure at least one campaign has `active = true`

### Check 3: Check Browser Console
Open browser DevTools (F12) → Console tab

Look for:
- "Fetched campaigns:" log message showing the campaigns
- Any error messages about RLS or permissions

### Check 4: Verify User Role
In Supabase Dashboard → SQL Editor, run:
```sql
SELECT user_id, role FROM public.user_roles WHERE user_id = 'YOUR_USER_ID';
```

Regular members should NOT have 'admin' or 'super_admin' role.

## Files Modified
1. `src/pages/member/Donate.tsx` - Error handling and terminology
2. `src/pages/admin/DonationCampaigns.tsx` - Terminology updates
3. `src/components/layout/MemberLayout.tsx` - Navigation label
4. `src/components/layout/AdminLayout.tsx` - Navigation labels
5. `src/components/layout/TreasurerLayout.tsx` - Navigation label
6. `src/pages/admin/DonationWallet.tsx` - Title and dialog updates

## SQL File
- `FIX_DONATION_CAMPAIGNS_RLS.sql` - RLS policy fixes

## Next Steps
1. Apply the SQL changes to your Supabase database
2. Rebuild and deploy the application
3. Test with both admin and member accounts
4. Verify members can see and contribute to funds drives

## Support
If issues persist:
1. Check Supabase logs for RLS errors
2. Verify user authentication status
3. Clear browser cache and reload
4. Check browser console for JavaScript errors
