# Hide Closed Events and Archived News

## Overview
Updated the application so that closed events and archived news no longer appear to members. Only active events and news are displayed.

## Changes Made

### 1. Events - Filter by Status
**File: src/pages/member/MemberEvents.tsx**
- Updated query to only fetch events with `status = 'active'`
- Removed status badge from event display (since all shown events are active)
- Closed events now disappear from member view

### 2. News - Add Status Field and Filtering
**Files Modified:**
- `src/pages/member/MemberNews.tsx` - Filter to show only active news
- `src/pages/admin/News.tsx` - Add archive/restore functionality

**Changes:**
- Added status column to news table (active/archived)
- Members only see active news
- Admins can archive/restore news without deleting it
- Added status badge to news cards in admin view
- Added Archive/Restore button next to Edit and Delete buttons

### 3. Database Migration
**File: ADD_STATUS_TO_NEWS.sql**
- Adds `status` column to news table with default value 'active'
- Creates index for faster filtering
- Updates existing news to be active

## How It Works

### For Members
- **Events**: Only see active events. Closed events disappear automatically.
- **News**: Only see active announcements. Archived news disappears automatically.

### For Admins
- **Events**: Can close events using the "Close" button. Closed events still visible in admin view but marked as closed.
- **News**: Can archive news using the "Archive" button. Archived news still visible in admin view but marked as archived.
  - Archive button changes to "Restore" for archived news
  - Can restore archived news back to active status

## Database Schema

### News Table
```sql
ALTER TABLE public.news
ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'));
```

## Testing Checklist

- [ ] Run `ADD_STATUS_TO_NEWS.sql` in Supabase SQL Editor
- [ ] Create a new news item - should be active by default
- [ ] Archive a news item - should disappear from member view
- [ ] Restore archived news - should reappear in member view
- [ ] Close an event - should disappear from member view
- [ ] Verify admin can still see closed/archived items
- [ ] Test in member dashboard - no closed events or archived news visible

## Next Steps

1. Execute the SQL migration in Supabase
2. Test the functionality with a test member account
3. Verify closed events and archived news are hidden from members
4. Confirm admins can still manage all items
