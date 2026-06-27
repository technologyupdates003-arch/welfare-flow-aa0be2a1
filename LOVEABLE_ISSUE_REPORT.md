# Issue Report: Members Dashboard Shows Zero Contributions

## Problem Summary
Bank statement import works — 46 transactions are successfully saved to `bank_transactions` table and 44 contribution records exist in `contributions` table. However, **members see $0 on their dashboard** despite having paid contributions.

## Root Cause Analysis

### What Works ✅
1. Bank statement parser correctly extracts Co-op Bank format (Debit/Credit columns)
2. Bank transactions are saved to `bank_transactions` table
3. Contributions are created in `contributions` table via SQL backfill
4. Treasurer dashboard shows contribution data correctly
5. Members have valid `user_id` → `auth.users` linkage

### What Doesn't Work ❌
1. Members dashboard queries `contributions` table but returns empty
2. Likely cause: Auth context `memberId` is NULL or mismatched
3. The `useAuth()` hook may not be finding the correct member record

### Database State
- Total bank_transactions: **46** ✅
- Total contributions: **44** ✅
- Members with valid user_id: **All linked correctly** ✅
- RLS Policy: **Allows authenticated access** ✅

## Investigation Steps Needed

Run this in the browser console when logged in as a member:

```javascript
const { data: { user } } = await supabase.auth.getUser();
console.log("Logged in as:", user?.email);

const { data: member } = await supabase
  .from("members")
  .select("*")
  .eq("user_id", user?.id)
  .maybeSingle();
console.log("Member record:", member);

const { data: contribs } = await supabase
  .from("contributions")
  .select("*")
  .eq("member_id", member?.id);
console.log("Contributions:", contribs);
```

Share the output. This will show:
1. If auth user is correctly logged in
2. If member record is linked to auth user
3. If contributions exist for that member

## Possible Issues

### Issue A: Auth Context Bug
The `useAuth()` hook in `src/lib/auth.tsx` calls `fetchMemberId()` which queries:
```typescript
.eq("user_id", userId)
```

If this is returning NULL, the member dashboard gets `memberId = null` and can't query contributions.

**Fix**: Add logging to `fetchMemberId()` to verify it's finding the record.

### Issue B: RLS Policy Blocking
The contribution RLS policy restricts access to:
```sql
member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
```

If the member's record doesn't have `user_id` set, this blocks access.

**Fix**: Verify all members have `user_id` set (already confirmed in SQL output above).

### Issue C: Query Cache Issue
React Query might be caching empty results from initial load.

**Fix**: Check if `queryClient.invalidateQueries()` is called on mount or add `staleTime: 0`.

## Next Steps

1. **Run the diagnostic JS code above** and share console output
2. **Check `src/lib/auth.tsx`** — add console.log to `fetchMemberId()` to verify it returns a value
3. **Check `src/pages/member/MemberDashboard.tsx`** — verify `memberId` is not null and contributions query runs
4. **Test with admin account** — admin should see all contributions regardless of auth linkage

## Files Modified in This Push

- `src/pages/treasurer/BankStatementImport.tsx` — Parser enhancements, debug logging
- `supabase/functions/bank-statement-import/index.ts` — Backend logging
- `POPULATE_CONTRIBUTIONS_FROM_BANK.sql` — Manual SQL backfill (already executed)

## Deployment Status

✅ Code changes pushed to GitHub  
✅ Database schema verified  
✅ RLS policies checked  
⏳ **Awaiting member login test to diagnose auth/query issue**

## Quick Fix Commands

If the issue is indeed auth context:

```typescript
// In MemberDashboard.tsx, add this debug log:
console.log("DEBUG: memberId =", memberId);
console.log("DEBUG: contributions =", contributions);
```

If `memberId` is null, the problem is in `useAuth()` hook.

## Contact

This is a high-priority issue affecting member experience. The data is correct in the database — it's a query/auth mismatch in the frontend.
