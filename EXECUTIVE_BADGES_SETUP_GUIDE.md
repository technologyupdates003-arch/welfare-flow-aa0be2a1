# Executive Badges Feature - Complete Setup Guide

## 📦 What's New
- **Executive Role Badges**: Visual badges for chairperson, vice chairperson, secretary, and vice secretary
- **Badge Management**: Admin panel to upload and manage role badges
- **Member Dashboard**: Members see their executive roles with badges
- **Executive Dashboard**: Dedicated dashboard for each executive role with badge display

## 🚀 Quick Start (3 Steps)

### Step 1: Apply Database Migration
**Copy and run this SQL in Supabase:**

```sql
-- Create executive_badges table for admin-uploaded badges
CREATE TABLE IF NOT EXISTS public.executive_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL UNIQUE,
  badge_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create bridge table to link members to executive roles with badges
CREATE TABLE IF NOT EXISTS public.member_executive_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  badge_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(member_id, role_name)
);

-- Enable RLS
ALTER TABLE public.executive_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_executive_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies (see full migration file for complete setup)
```

**Full migration file:** `supabase/migrations/20260704_add_executive_badges.sql`

### Step 2: Create Storage Bucket
In Supabase Dashboard → Storage:
1. Click **Create new bucket**
2. Name: `badges`
3. Check **Make it public**
4. Click **Create**

### Step 3: Create Badges
1. Log in as **Admin**
2. Go to: **Admin Panel** → **Executive Badges**
3. Click **Add New Badge**
4. Upload badge for each role:
   - ✅ Chairperson
   - ✅ Vice Chairperson
   - ✅ Secretary
   - ✅ Vice Secretary

## 🎯 How to Use

### For Admins
```
1. Login → Admin Dashboard
2. Click "Executive Badges" in sidebar
3. Upload badge images for each role
4. (Optional) Add descriptions
```

### For Members
```
1. Login as member
2. Go to member dashboard
3. See "Your Executive Roles" section (if assigned)
4. Click on any role to view:
   - Badge display
   - Role information
   - Responsibilities
   - Current status
```

## 📁 Files Changed/Created

### New Files
- `src/pages/admin/ExecutiveBadges.tsx` - Badge management interface
- `src/pages/member/ExecutiveDashboard.tsx` - Executive role dashboard
- `supabase/migrations/20260704_add_executive_badges.sql` - Database migration

### Modified Files
- `src/pages/member/MemberDashboard.tsx` - Added "Your Executive Roles" section
- `src/App.tsx` - Added new routes and imports

## 🔑 Key Features

### Admin Features
- ✅ Create/Edit/Delete badges
- ✅ Upload images (PNG, JPG, SVG - max 5MB)
- ✅ Add optional descriptions
- ✅ Preview badges before upload
- ✅ Audit trail (who created/updated)

### Member Features
- ✅ View assigned executive roles on dashboard
- ✅ See badge image with role
- ✅ Click to view dedicated role dashboard
- ✅ Switch between multiple roles
- ✅ View role responsibilities

### Dashboard Features
- ✅ Full badge display
- ✅ Member information (name, ID, assignment date)
- ✅ Role description and duties
- ✅ Active status indicator
- ✅ Role switcher for multiple roles

## 🔐 Security

### Row-Level Security (RLS) Policies
- ✅ Public can view badges (read-only)
- ✅ Admin only can manage badges
- ✅ Members see their roles automatically
- ✅ Audit trail for all changes

### Storage Policies
- ✅ Authenticated users can view badges
- ✅ Admin only can upload/delete

## 📊 Database Schema

### executive_badges Table
```sql
id UUID                     -- Primary key
role_name TEXT UNIQUE       -- Chairperson, Vice Chair, Secretary, Vice Sec
badge_url TEXT              -- URL to badge image
description TEXT            -- Optional description
created_at TIMESTAMP        -- Auto timestamp
updated_at TIMESTAMP        -- Auto timestamp
created_by UUID            -- Audit: who created
updated_by UUID            -- Audit: who updated
```

### member_executive_roles Table
```sql
id UUID                     -- Primary key
member_id UUID              -- Link to members table
role_name TEXT              -- Executive role
badge_url TEXT              -- Cached badge URL
is_active BOOLEAN           -- Active/inactive flag
created_at TIMESTAMP        -- Auto timestamp
updated_at TIMESTAMP        -- Auto timestamp
UNIQUE(member_id, role_name) -- One role per member
```

## 🚦 Routes Added

### Admin Routes
- `/admin/executive-badges` - Badge management page

### Member Routes  
- `/member/executive/:roleName` - Executive dashboard view

## ⚙️ Configuration

### Executive Roles Supported
- `chairperson` - Chairperson
- `vice_chairperson` - Vice Chairperson
- `secretary` - Secretary
- `vice_secretary` - Vice Secretary

### Image Upload Settings
- **Max size**: 5MB
- **Formats**: PNG, JPG, JPEG, SVG (recommended: PNG or SVG)
- **Storage**: Supabase public bucket
- **CDN**: Automatic via Supabase

## 🐛 Troubleshooting

### Issue: 404 Errors on Badge Queries
**Solution:** Apply the migration first
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('executive_badges', 'member_executive_roles');
```

### Issue: Upload Fails
**Check:**
1. Storage bucket "badges" is PUBLIC
2. File size < 5MB
3. File format is image (PNG, JPG, SVG)
4. User has admin role

### Issue: Badges Not Showing on Dashboard
**Check:**
1. Member is assigned to `member_executive_roles` table
2. Member's role `is_active = true`
3. Badge exists in `executive_badges` table
4. Browser cache cleared (Ctrl+Shift+Delete)

### Issue: Permission Denied
**Check:**
1. User has admin role
2. RLS policies are enabled
3. User email matches auth.users table

## 📈 Workflow Example

```
1. Admin uploads Chairperson badge
   → Badge stored in storage
   → Record created in executive_badges table

2. Admin assigns John to chairperson role
   → Record created in member_executive_roles
   → Links member_id to role_name

3. John logs in
   → Dashboard loads
   → Queries show member_executive_roles for John
   → Badge URL fetched from executive_badges
   → "Your Executive Roles" section displays

4. John clicks on Chairperson role
   → Navigates to /member/executive/chairperson
   → Executive Dashboard loads
   → Shows badge, member info, role description
```

## 🎨 UI Components

- **Card**: Display role information and badges
- **Badge**: Show status and role type
- **Button**: Navigation and actions
- **Dialog**: Create/edit badge forms
- **Input**: File upload for images
- **Image**: Badge preview and display

## 📱 Mobile Responsive
- ✅ Dashboard cards stack on mobile
- ✅ Badge images scale properly
- ✅ Touch-friendly buttons
- ✅ Responsive grid layout

## 🌙 Dark Mode Support
- ✅ All colors adapt to dark mode
- ✅ Badge previews have contrast
- ✅ Form elements themed properly

## 📝 Admin Checklist

- [ ] Apply database migration
- [ ] Create "badges" storage bucket
- [ ] Upload all 4 role badges
- [ ] Add descriptions (optional)
- [ ] Test with member account
- [ ] Assign members to roles
- [ ] Verify badges display on dashboard

## 📚 Related Documentation

- **Badge Implementation**: `EXECUTIVE_BADGES_IMPLEMENTATION.md`
- **Migration Instructions**: `APPLY_EXECUTIVE_BADGES_MIGRATION.md`
- **Full Migration SQL**: `supabase/migrations/20260704_add_executive_badges.sql`

## 🎉 Features Coming Soon

- [ ] Badge expiration dates
- [ ] Role change history
- [ ] Download badge as image
- [ ] Social sharing of badges
- [ ] Multiple badge sizes
- [ ] Email notifications on role assignment
- [ ] Role succession planning

## ✅ Build Status

- ✅ TypeScript compilation successful
- ✅ All routes configured
- ✅ All components working
- ✅ Production bundle: 3,920.84 kB (gzipped: 1,083.68 kB)
- ✅ Ready for deployment

## 📞 Support

For issues or questions:
1. Check browser console for error messages
2. Check Supabase logs
3. Verify migration was applied
4. Verify RLS policies
5. Check user role permissions

## 🚀 Deployment

The updated application is ready for deployment:
- Build: `/dist` folder (3.9 MB zip)
- No breaking changes to existing features
- Backward compatible
- All existing data preserved

## Version History

- **v1.0.0** (2026-07-04) - Initial release
  - Executive badge system
  - Admin badge management
  - Member dashboard integration
  - Executive role dashboards
