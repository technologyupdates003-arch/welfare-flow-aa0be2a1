# Apply Executive Badges Migration

## Status
The Executive Badges feature has been implemented, but the database tables need to be created. You're seeing 404 errors because the `executive_badges` and `member_executive_roles` tables don't exist yet in Supabase.

## Steps to Apply Migration

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase Project Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire content from: `supabase/migrations/20260704_add_executive_badges.sql`
5. Paste into the SQL editor
6. Click **Run**

### Option 2: Using Supabase CLI
```bash
cd /home/laban/projects/welfare-flow-aa0be2a1
supabase db push
```

## Migration Details
The migration creates:
1. **executive_badges** table - Stores badge images and descriptions
2. **member_executive_roles** table - Links members to roles with badges
3. **RLS Policies** - Row-level security for both tables
4. **Triggers** - Auto-update timestamps
5. **Storage Bucket** - "badges" for image uploads

## After Migration

### 1. Create Storage Bucket
In Supabase Dashboard:
1. Go to **Storage**
2. Click **Create new bucket**
3. Name it: `badges`
4. Make it **Public**
5. Add the following policy:
   - **Authenticated users** can SELECT
   - **Admin users** can INSERT, UPDATE, DELETE

### 2. Access Admin Panel
1. Log in as Admin
2. Go to: **Admin Panel → Executive Badges**
3. Click **Add New Badge**
4. Upload badges for each executive role:
   - Chairperson
   - Vice Chairperson
   - Secretary
   - Vice Secretary

### 3. Assign Members to Roles
Use your existing member management system to assign members to executive roles. The badge will automatically appear.

## Troubleshooting

### Still seeing 404 errors?
- Refresh the browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)
- Wait 30 seconds for changes to propagate
- Check Supabase connection in browser DevTools

### Storage bucket error?
- Ensure "badges" bucket is PUBLIC
- Verify RLS policy allows authenticated users to SELECT

### Members not seeing badges?
- Verify migration was applied successfully:
  ```sql
  SELECT * FROM executive_badges;
  SELECT * FROM member_executive_roles;
  ```
- Check RLS policies are enabled
- Ensure member is assigned a role in `member_executive_roles` table

## SQL to Verify Setup
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('executive_badges', 'member_executive_roles');

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('executive_badges', 'member_executive_roles');

-- Check data
SELECT COUNT(*) as badge_count FROM executive_badges;
SELECT COUNT(*) as role_count FROM member_executive_roles;
```

## Files Involved
- Migration: `supabase/migrations/20260704_add_executive_badges.sql`
- Admin Component: `src/pages/admin/ExecutiveBadges.tsx`
- Member Dashboard: `src/pages/member/MemberDashboard.tsx` (Updated)
- Executive Dashboard: `src/pages/member/ExecutiveDashboard.tsx`
- Routes: `src/App.tsx` (Updated)

## Feature Highlights
✅ Admin can upload and manage badges
✅ Members see executive roles on dashboard
✅ Click role to view dedicated dashboard
✅ Automatic badge display with role information
✅ Support for 4 executive roles
✅ Secure RLS policies
✅ Audit trail (created_by, updated_by)

## Support
For issues after migration, check:
1. Browser console for error messages
2. Supabase logs for database errors
3. Network tab for failed API requests
4. RLS policies are correctly configured
