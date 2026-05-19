# Welfare Flow Deployment Package
Generated: 2026-05-18 12:01:46
Build Version: 20260518_120143

## Changes Included in This Build
1. ✅ Fixed mobile zoom locking - users can now pinch-to-zoom on mobile
2. ✅ Fixed campaign creation error - removed collected_amount from insert (uses DB default)
3. ✅ Withdrawal receipts now role-restricted (only visible to users with roles)
4. ✅ Better error handling and logging for campaign creation

## Files Modified
- index.html (viewport meta tag - removed maximum-scale and user-scalable)
- src/index.css (added touch-action: manipulation for mobile zoom)
- src/pages/admin/DonationCampaigns.tsx (removed collected_amount from insert, better error logging)
- src/pages/member/MemberDashboard.tsx (minor import addition)

## Deployment Instructions
1. Extract this package to a temporary location
2. Copy the 'frontend' folder contents to your web server root (e.g., /var/www/html or public_html)
3. Ensure .htaccess is in place for SPA routing (included in package)
4. Clear browser cache if needed (Ctrl+Shift+Delete or Cmd+Shift+Delete)
5. Test campaign creation in admin panel

## Build Info
- Build Date: 2026-05-18 12:01:46
- Node Version: v22.19.0
- Build Tool: Vite v7.3.2
- Build Status: ✅ SUCCESS

## Testing Checklist
- [ ] Mobile: Test pinch-to-zoom on iOS/Android
- [ ] Mobile: Verify double-tap zoom is disabled
- [ ] Admin: Create a new donation campaign
- [ ] Admin: Verify campaign appears in list
- [ ] Member: Verify withdrawal receipts link is NOT visible
- [ ] Admin/Chairperson: Verify withdrawal receipts link IS visible
- [ ] Desktop: Verify Ctrl+/- zoom still works

## Rollback Instructions
If issues occur, restore the previous deployment package from deploy-packages folder.
