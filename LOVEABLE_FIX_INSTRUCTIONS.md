# Loveable: Fix Members Dashboard Contributions Display

## Executive Summary
Members see $0 contributions on their dashboard even though:
- 46 bank transactions are in the database ✅
- 44 contribution records exist ✅
- Treasurer can see them ✅

**The problem is in the member dashboard query/auth context, not the data.**

---

## Step 1: Diagnose the Issue

### Option A: Test via Browser Console

1. Deploy the latest code
2. Log in as a member (phone: +254721294219, password: Member2026)
3. Open DevTools (F12) → Console
4. Paste this code:

```javascript
import { supabase } from "@/integrations/supabase/client";

(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  console.log("1. Auth user:", user?.email, user?.id);

  if (!user) return;
  
  const { data: member } = await supabase
    .from("members")
    .select("id, name, user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  console.log("2. Member record:", member);

  if (!member) return;
  
  const { data: contribs } = await supabase
    .from("contributions")
    .select("*")
    .eq("member_id", member.id);
  console.log("3. Contributions:", contribs);
})();
```

5. **Share the console output**

### Option B: Add Debug Logging to Code

Edit `src/lib/auth.tsx`:

```typescript
const fetchMemberId = async (userId: string) => {
  const { data } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  console.log("[DEBUG] fetchMemberId for", userId, ':', data?.id); // ADD THIS
  return data?.id || null;
};
```

Then check browser console when member logs in. Should show the member ID.

---

## Step 2: Probable Fix (Most Likely Culprit)

The issue is likely in `src/pages/member/MemberDashboard.tsx` line ~73:

```typescript
const { data: contributions } = useQuery({
  queryKey: ["my-contributions", memberId],
  queryFn: async () => {
    if (!memberId) return [];  // ← IF memberId IS NULL, THIS RETURNS EMPTY!
    const { data } = await supabase
      .from("contributions")
      .select("*")
      .eq("member_id", memberId)
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    return data || [];
  },
  enabled: !!memberId,  // ← QUERY DISABLED IF memberId IS NULL
});
```

**Likely problem: `memberId` is NULL because `useAuth()` isn't finding the member record.**

### Quick Verification

Add this to MemberDashboard.tsx right after `const { memberId } = useAuth();`:

```typescript
useEffect(() => {
  console.log("[MemberDashboard] memberId:", memberId);
  console.log("[MemberDashboard] contributions query:", contributions?.data);
}, [memberId, contributions]);
```

---

## Step 3: Fix the Auth Context

If `memberId` is NULL, the problem is in `src/lib/auth.tsx` function `fetchMemberId()`.

It's querying:
```typescript
.eq("user_id", userId)
```

But newly imported members might have a different email format. **Try this fix:**

```typescript
const fetchMemberId = async (userId: string) => {
  // First try exact match
  let { data } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  
  if (data?.id) {
    console.log("[DEBUG] Found member by user_id:", data.id);
    return data.id;
  }

  // If no exact match, try by email pattern
  const { data: { user } } = await supabase.auth.admin.getUser(userId);
  if (user?.email) {
    const phoneFromEmail = user.email.split('@')[0]; // Extract phone from email
    const { data: memberByPhone } = await supabase
      .from("members")
      .select("id")
      .eq("phone", '+' + phoneFromEmail) // Phone is stored as +254...
      .maybeSingle();
    
    if (memberByPhone?.id) {
      console.log("[DEBUG] Found member by phone:", memberByPhone.id);
      return memberByPhone.id;
    }
  }
  
  console.log("[DEBUG] No member found for user", userId);
  return null;
};
```

---

## Step 4: Test the Fix

1. Deploy the updated code
2. Log in as a member
3. Open browser console
4. Verify:
   - `memberId` is NOT null
   - Contributions array has data
   - Dashboard shows amounts

---

## Step 5: Alternative Fix (If Above Doesn't Work)

If the auth context is working but dashboard still shows zero, the issue is RLS.

Run this in Supabase SQL Editor to verify RLS isn't blocking:

```sql
-- Test if authenticated user can see their contributions
SELECT c.* 
FROM public.contributions c
WHERE c.member_id IN (
  SELECT m.id FROM public.members m 
  WHERE m.user_id = auth.uid()
);
```

If this returns zero but we know contributions exist, RLS is the problem.

**Fix: Update RLS policy in Supabase:**

```sql
DROP POLICY IF EXISTS "Members view own contributions" ON public.contributions;

CREATE POLICY "Members view own contributions" ON public.contributions 
FOR SELECT TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin')
  OR
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);
```

---

## Step 6: Verification Checklist

- [ ] Member logs in successfully
- [ ] Browser console shows: `memberId = [UUID]` (NOT null)
- [ ] Browser console shows: `contributions = [{...}]` (NOT empty array)
- [ ] Dashboard displays contribution amounts
- [ ] Dashboard shows "Total Contributed This Year"
- [ ] "Overdue Payments" section updates correctly

---

## Files to Check/Modify

1. **`src/lib/auth.tsx`** — `fetchMemberId()` function (likely fix here)
2. **`src/pages/member/MemberDashboard.tsx`** — Add debug logging
3. **Supabase Dashboard** — Verify RLS policies (if needed)

---

## Quick Deploy Commands

```bash
# After making fixes, rebuild and deploy:
npm run build
zip -r welfare-flow-build.zip dist/
cp welfare-flow-build.zip ~/Downloads/

# Then upload dist/ folder to your hosting
```

---

## Contact & Support

This is a frontend/auth context issue, not a data issue. The database is correct.

**Priority:** HIGH - Members can't see their contribution history
**Severity:** MEDIUM - Treasurer dashboard works fine, only member portal affected
**Time to fix:** 30 minutes (most likely one-line change)

---

## Useful Queries for Debugging

Run these in Supabase SQL Editor:

```sql
-- Check all members with their auth users
SELECT m.id, m.name, m.phone, m.user_id, au.email
FROM public.members m
LEFT JOIN auth.users au ON m.user_id = au.id
LIMIT 10;

-- Count contributions per member
SELECT m.name, COUNT(c.id) as contribution_count, SUM(c.amount) as total
FROM public.members m
LEFT JOIN public.contributions c ON m.id = c.member_id
GROUP BY m.id, m.name
ORDER BY total DESC;

-- Check specific member's full data
SELECT * FROM public.members WHERE phone = '+254721294219';
SELECT * FROM public.contributions WHERE member_id = '[MEMBER_ID_FROM_ABOVE]';
```

Good luck! 🚀
