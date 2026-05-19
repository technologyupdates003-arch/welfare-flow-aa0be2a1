# Contribute Button Fix - Complete

## Problem
Members clicking the "Contribute" button in the sidebar were experiencing a "blinking" effect where the page would not navigate to the Funds Drive contribution page.

## Root Cause
The `/member/donate` route was missing from the plain member role's route configuration in `App.tsx`. While the route existed for admin, super_admin, chairperson, and other roles, it was not defined for users with the plain "member" role.

## Solution Applied

### 1. Added Missing Route (App.tsx)
Added the donate route to the plain member role routes:
```tsx
<Route path="/member/donate" element={<MemberLayout><Donate /></MemberLayout>} />
```

### 2. Enhanced Error Handling (Donate.tsx)
- Added `isLoading` state from useQuery to properly detect loading state
- Added `queryError` to capture and display query errors
- Improved loading UI with spinner and message
- Added error alert when campaigns fail to load
- Added retry logic (3 retries with 1s delay) for failed requests
- Enhanced console logging for debugging

### 3. Fixed Table Structure (DonationCampaigns.tsx)
- Fixed DOM nesting warning by replacing `<TableHead>` components with `<th>` elements in the table header
- Removed unused `TableHeader` import

### 4. Fixed Duplicate Imports
- Removed duplicate `TrendingUp` import in `TreasurerDashboard.tsx`
- Removed unused `TableHeader` import in `DonationCampaigns.tsx`

## Files Modified
1. `src/App.tsx` - Added missing `/member/donate` route
2. `src/pages/member/Donate.tsx` - Enhanced error handling and loading states
3. `src/pages/admin/DonationCampaigns.tsx` - Fixed table structure
4. `src/pages/treasurer/TreasurerDashboard.tsx` - Fixed duplicate import
5. `src/components/layout/MemberLayout.tsx` - No changes needed (route was correct)

## Testing
Members should now be able to:
1. Click the "Contribute" button in the sidebar
2. Navigate to the Funds Drive page
3. See active funds drives (if any exist and RLS policies are configured)
4. Select a funds drive and contribute via M-Pesa

## Next Steps
1. Ensure RLS policies are configured in Supabase for `donation_campaigns` table
2. Run the SQL from `FIX_DONATION_CAMPAIGNS_RLS.sql` to allow members to view active campaigns
3. Test the full contribution flow end-to-end

## Related Issues
- RLS policies for donation_campaigns table need to be configured (see `FIX_DONATION_CAMPAIGNS_RLS.sql`)
- User presence endpoint returning 401 (separate issue, not blocking this feature)
