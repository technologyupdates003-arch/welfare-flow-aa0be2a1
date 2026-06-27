# Quick Diagnosis Flowchart

## Step 1: Deploy & Login
```
Deploy welfare-flow-debug-build.zip dist/ to hosting
↓
Open browser DevTools (F12 → Console)
↓
Login as +254721294219 / Member2026
↓
Look in console for logs starting with [AUTH DEBUG] and [MemberDashboard]
```

---

## Step 2: Check Logs (Copy-Paste Flow)

### Q1: Do you see `[AUTH DEBUG]` logs?
```
YES → Go to Q2
NO → Issue: Build not deployed correctly or old build cached
      Solution: Hard refresh (Ctrl+Shift+R), clear browser cache, redeploy
```

### Q2: Do logs show `[AUTH DEBUG] Found member by exact user_id match: [UUID]`?
```
YES → Go to Q3
NO → Check for `[AUTH DEBUG] Extracted phone from email: +254721294219`
     ↓
     If YES → Check `[AUTH DEBUG] Fallback match result: [UUID]`
              If shows UUID: Go to Q3
              If shows undefined: Go to Q4
     ↓
     If NO → Go to Q5 (phone extraction failed)
```

### Q3: Do logs show `[MemberDashboard] Current memberId: [UUID]`? (Not null)
```
YES → Go to Q6
NO → memberId is null/undefined
     This means fetchMemberId returned null
     ↓
     ACTION: Run this in Supabase SQL:
     SELECT * FROM public.members WHERE phone LIKE '%721294219%';
     ↓
     If member exists: Auth context issue, see Q4
     If NO members: Import issue, re-run bank statement import
```

### Q4: Check Contribution Query Logs
```
Look for: [MemberDashboard] Contributions fetched: X records

X > 0 → Dashboard should show amounts
        If still shows $0 → Display/calculation bug, share logs

X = 0 → Contributions exist but query returned nothing
        This means RLS is blocking
        ↓
        ACTION: Run in Supabase SQL:
        SELECT c.* FROM public.contributions c 
        WHERE c.member_id IN (
          SELECT id FROM public.members WHERE phone LIKE '%721294219%'
        );
        ↓
        If returns data: RLS policy needs fix
        If returns nothing: Member_id mismatch, check member record
```

### Q5: Phone Extraction Failed
```
Check log: [AUTH DEBUG] Extracted phone from email: [result]

If shows null:
  Email might be in wrong format
  Check: user.email from auth.users table
  Expected format: 254721294219@welfare.local
  ↓
  ACTION: Verify in auth.users:
  SELECT email, user_id FROM auth.users WHERE email LIKE '%721294%';
  
If shows empty string:
  phoneFromEmail regex not matching
  Check auth.tsx lines 45-49
  
If shows something else:
  Phone normalization might be failing
  Check normalizePhone function, auth.tsx lines 40-46
```

### Q6: Everything Looks Good in Logs
```
If memberId ≠ null
AND Contributions fetched > 0
AND Dashboard shows $0

Issue is in JavaScript calculation/display logic
↓
ACTION: Check these lines in MemberDashboard.tsx:
- Line 142: totalPaidAllTime calculation
- Line 144: totalPaidThisYear calculation
- Line 148-149: Display of values

Check if contributions array is being filtered correctly
```

---

## Common Issues & Quick Fixes

### Issue: "BUILD_COMPLETE" Error / TypeScript Errors
```
Solution: npm run build was run before
         This created a BUILD_COMPLETE file
         Delete it and rebuild:
         
         rm -f BUILD_COMPLETE.md
         npm run build
```

### Issue: "Cannot find module" errors after git pull
```
Solution: Dependencies not installed
         Run: npm install
         Then: npm run build
```

### Issue: Member doesn't exist in database
```
Solution: Bank statement import wasn't run
         Go to Treasurer → Bank Statement Import
         Upload the Excel file again
         Check for "46 transactions imported" message
```

### Issue: Member exists but memberId still null
```
Solution: user_id not set in members table
         Run in Supabase SQL:
         
         UPDATE public.members m
         SET user_id = au.id
         FROM auth.users au
         WHERE au.email = CONCAT(REPLACE(m.phone, '+', ''), '@welfare.local')
         AND m.user_id IS NULL;
```

### Issue: Dashboard shows data but amounts are wrong
```
Solution: Check status filter
         Open browser console, run:
         
         // This is what the dashboard does:
         const paid = contributions.filter(c => c.status === "paid")
         console.log("Paid contributions:", paid);
         
         All contributions should have status = 'paid'
         If some are 'unpaid', they're excluded
```

---

## Fastest Debugging Path (Recommended)

1. **Copy these commands** and paste in browser DevTools Console:

```javascript
// Check auth state
import { supabase } from "@/integrations/supabase/client";

(async () => {
  console.log("\n=== WELFARE FLOW DEBUG ===\n");
  
  // 1. Check auth user
  const { data: { user } } = await supabase.auth.getUser();
  console.log("✓ Auth User ID:", user?.id);
  console.log("✓ Auth Email:", user?.email);
  
  // 2. Check member lookup
  const { data: member } = await supabase
    .from("members")
    .select("id, name, phone, user_id")
    .eq("user_id", user?.id)
    .maybeSingle();
  console.log("✓ Member Found:", !!member?.id);
  console.log("✓ Member ID:", member?.id);
  console.log("✓ Member Name:", member?.name);
  
  // 3. Check contributions
  if (member?.id) {
    const { data: contribs } = await supabase
      .from("contributions")
      .select("id, amount, status, year, month")
      .eq("member_id", member.id);
    console.log("✓ Contributions Count:", contribs?.length || 0);
    console.log("✓ Contributions Data:", contribs);
  }
  
  console.log("\n=== END DEBUG ===\n");
})();
```

2. **Share the console output** - this shows:
   - Is user authenticated?
   - Is member found?
   - Are contributions in database?
   - What are the actual values?

3. **We'll identify the issue** in seconds from the output

---

## When to Escalate

Contact if you see:
- ❌ Same memberId/contributions logs but dashboard still shows $0
- ❌ More than one member affected
- ❌ Import shows 0 transactions
- ❌ JavaScript errors in console (not just warnings)
- ❌ Any "permission denied" or SQL errors

---

## File Locations for Fixes

| Issue | File | Line |
|-------|------|------|
| memberId null | `src/lib/auth.tsx` | 52-96 |
| Phone extraction fails | `src/lib/auth.tsx` | 40-50 |
| Contributions query returns 0 | `src/pages/member/MemberDashboard.tsx` | 80-95 |
| Display shows wrong amounts | `src/pages/member/MemberDashboard.tsx` | 142-149 |
| RLS blocking access | Supabase Dashboard | Policies tab |

---

## Success Indicators ✅

When issue is fixed, you'll see:
```
[AUTH DEBUG] Found member by exact user_id match: [UUID]
[MemberDashboard] Current memberId: [UUID]
[MemberDashboard] Fetching contributions for memberId: [UUID]
[MemberDashboard] Contributions fetched: 1 records [{...}]

Dashboard displays:
- Total Contributed: KES 800
- Unpaid: KES 0
- Overdue: KES 0
```

---

## Debug Build Details

**Build File**: `welfare-flow-debug-build.zip` (~/Downloads/)
**Size**: 3.9 MB
**What's Added**: 
- Console logging in auth context
- Console logging in member dashboard
- No functional changes
- No performance impact

**Safe to Deploy?** ✅ Yes, logs are development-only and hidden in production builds

---

## Next Steps

1. Deploy the debug build
2. Test login and collect console logs
3. Follow the flowchart above
4. Share output if stuck

Good luck! 🔍
