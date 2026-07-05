# Executive Badge Feature Documentation

## Overview
The Executive Badge feature allows admin users to create and manage badges for executive roles (Chairperson, Vice Chairperson, Secretary, Vice Secretary). Members with these roles can view their badges and executive role dashboards.

## Database Structure

### Tables Created
1. **executive_badges** - Stores badge images and information for each role
   - `id` (UUID) - Primary key
   - `role_name` (TEXT UNIQUE) - Role identifier (chairperson, vice_chairperson, secretary, vice_secretary)
   - `badge_url` (TEXT) - URL to the badge image
   - `description` (TEXT) - Optional description
   - `created_at`, `updated_at` - Timestamps
   - `created_by`, `updated_by` - User references

2. **member_executive_roles** - Links members to their executive roles
   - `id` (UUID) - Primary key
   - `member_id` (UUID) - Reference to members table
   - `role_name` (TEXT) - Executive role
   - `badge_url` (TEXT) - Badge URL (cached for quick access)
   - `is_active` (BOOLEAN) - Role status
   - `created_at`, `updated_at` - Timestamps
   - Unique constraint on (member_id, role_name)

### Row Level Security (RLS)
- **executive_badges**: Anyone can view; only admins can create/update/delete
- **member_executive_roles**: Anyone can view their own roles; only admins can manage assignments

### Storage Bucket
- **badges** - Supabase storage bucket for badge images (public)

## Components

### 1. Admin: Executive Badge Management
**File**: `src/pages/admin/ExecutiveBadgeManagement.tsx`

Features:
- Create new badges for each executive role
- Upload badge images (supports PNG, JPG, JPEG; max 5MB)
- Edit existing badge images and descriptions
- Delete badges
- Grid view of all badges with metadata
- Upload status tracking

Menu Location: `/admin/executive-badges`

### 2. Member Dashboard Enhancement
**File**: `src/pages/member/MemberDashboard.tsx`

New Section: "My Executive Roles"
- Displays all active executive roles assigned to the member
- Shows badge thumbnail for each role
- Click to view the executive role dashboard
- Responsive grid layout (1 column mobile, 2 columns desktop)

### 3. Executive Dashboard
**File**: `src/pages/member/ExecutiveDashboard.tsx`

Route: `/member/executive/:roleName`

Features:
- Role-specific dashboard showing the member's badge
- Badge display with member and role information
- Role-specific information and responsibilities
- Tab-based navigation if member has multiple roles
- Access control: members can only view their assigned roles
- Large badge display with gradient background
- Member details and status information

### 4. Admin Layout Menu
**File**: `src/components/layout/AdminLayout.tsx`

Added Menu Item:
- Path: `/admin/executive-badges`
- Label: "Executive Badges"
- Icon: Award

## Workflow

### Admin Setup (Initial Configuration)
1. Navigate to Admin > Executive Badges
2. Click "Add Badge"
3. Select executive role (Chairperson, Vice Chairperson, Secretary, Vice Secretary)
4. Upload badge image (PNG/JPG/JPEG, max 5MB)
5. Add optional description
6. Save

### Admin Assignment
Admins assign executive roles to members using the user_roles table.

### Member View
1. Member logs in and views their dashboard
2. "My Executive Roles" section shows all assigned roles with badges
3. Click on a role card to view the executive dashboard
4. Executive dashboard displays:
   - Large badge image
   - Role name and status
   - Member information
   - Role responsibilities
   - Navigation to other assigned roles (if any)

## Database Migration

File: `supabase/migrations/20260704_add_executive_badges.sql`

Run this migration to set up:
- Tables with proper constraints
- RLS policies
- Storage bucket configuration
- Triggers for updated_at timestamps

## API Endpoints Used

- `GET /executive_badges` - Fetch all badges
- `GET /executive_badges?role_name=eq.chairperson` - Fetch specific badge
- `GET /member_executive_roles?member_id=eq.{id}` - Fetch member's roles
- `POST /executive_badges` - Create badge (admin only)
- `PATCH /executive_badges?id=eq.{id}` - Update badge (admin only)
- `DELETE /executive_badges?id=eq.{id}` - Delete badge (admin only)
- `POST /storage/object/badges` - Upload badge image

## Query Keys (React Query)

```typescript
// Admin badge management
["executive-badges"] // List all badges

// Member executive roles
["member-executive-roles", memberId] // Specific member's roles

// Badge details
["executive-badge", roleName] // Specific badge
```

## User Roles & Permissions

### Admin
- ✅ Create badges
- ✅ Upload/edit/delete badge images
- ✅ Assign roles to members
- ✅ View all badges and assignments

### Members with Executive Roles
- ✅ View their own badges
- ✅ View executive dashboard
- ✅ See their role information
- ❌ Modify badges (read-only)

### Regular Members
- ❌ No access to executive features

## File Structure

```
src/
├── pages/
│   ├── admin/
│   │   └── ExecutiveBadgeManagement.tsx    (NEW)
│   └── member/
│       ├── MemberDashboard.tsx            (MODIFIED)
│       └── ExecutiveDashboard.tsx         (NEW)
├── components/
│   └── layout/
│       └── AdminLayout.tsx                (MODIFIED)
└── App.tsx                                (MODIFIED)

supabase/
└── migrations/
    └── 20260704_add_executive_badges.sql  (NEW)
```

## Future Enhancements

1. **Badge Customization**
   - Color themes for badges
   - Custom badge editor
   - Badge templates

2. **Role Permissions**
   - Specific permissions per role
   - Role-based feature access
   - Permission inheritance

3. **Badge Analytics**
   - View badge assignment history
   - Track role changes
   - Generate role reports

4. **Notifications**
   - Notify member when role assigned
   - Role expiration warnings
   - Role change alerts

## Troubleshooting

### Badge Not Showing
- Ensure badge image URL is accessible
- Check member's executive role is active (is_active = true)
- Verify RLS policies allow access

### Upload Failed
- Check file size (max 5MB)
- Verify image format (PNG/JPG/JPEG)
- Ensure storage bucket exists
- Check user permissions

### Member Can't Access Dashboard
- Verify user has member role assigned
- Check if executive role is assigned via user_roles table
- Verify is_active = true in member_executive_roles
- Check browser console for errors

## Testing

1. **Create Badge**
   - Login as admin
   - Navigate to Executive Badges
   - Create badge for Chairperson
   - Verify image displays

2. **View in Member Dashboard**
   - Assign role to test member
   - Login as member
   - Verify badge appears in "My Executive Roles"
   - Click to view executive dashboard

3. **Multiple Roles**
   - Assign multiple roles to member
   - Verify all badges display
   - Test switching between roles using tabs

4. **Access Control**
   - Try accessing others' badges (should fail)
   - Try modifying badge as non-admin (should fail)
   - Verify non-executive members see no badges

## Performance Considerations

- Badge images cached in storage
- RLS policies optimized with indexed columns
- React Query caching prevents unnecessary requests
- Images lazy-loaded in member dashboard

## Security

- RLS prevents unauthorized access
- Only admins can upload/modify badges
- Badge URLs public (intentional for display)
- Member roles validated on backend
