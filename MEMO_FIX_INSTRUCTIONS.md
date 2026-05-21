# Memo History Fix Instructions

## Problem
The memo history page is returning a 400 Bad Request error because the RLS (Row Level Security) policies are too restrictive.

## Solution

### Step 1: Run the SQL Fix in Supabase
1. Go to your Supabase dashboard: https://app.supabase.com
2. Navigate to your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy and paste the contents of `FIX_MEMO_RLS.sql`
6. Click **Run**

### What the SQL does:
- Removes the old restrictive RLS policies that only allowed treasurers to view memos
- Creates new policies that allow:
  - **All authenticated users** to VIEW memos
  - **Only treasurers/admins** to CREATE, UPDATE, or DELETE memos
  - **Members** to update their own memo tracking (seen_at, downloaded_at)

### Step 2: Refresh Your Browser
After running the SQL:
1. Refresh your browser (F5 or Cmd+R)
2. Navigate to the Memo History page
3. You should now see all memos loading without errors

## Why This Happened
The original RLS policy checked if the user had a "treasurer" role in the `user_roles` table. If the current user didn't have this role, the query would fail with a 400 error. The new policy allows all authenticated users to view memos, which is appropriate since memos are meant to be shared with members.

## Verification
After applying the fix, you should see:
- ✅ Memo history page loads without errors
- ✅ All previous memos appear in the list
- ✅ New memos created appear immediately
- ✅ AI chat is visible in the treasurer layout
