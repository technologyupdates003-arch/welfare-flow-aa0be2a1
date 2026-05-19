# Beneficiary Relationship Update

## Changes Made

Updated the beneficiary relationship dropdown options across the application to only include: Spouse, Child, Parent, and Next of Kin.

### Previous Options
- Spouse
- Child
- Parent
- Sibling ❌ (REMOVED)
- Other ❌ (REMOVED)

### New Options (Final)
- Spouse
- Child
- Parent
- Next of Kin ✅

## Files Updated

1. **src/pages/member/MemberBeneficiaries.tsx**
   - Updated relationship dropdown in the "Add Beneficiary" form
   - Removed "Other" option

2. **src/pages/secretary/SecretaryDashboard.tsx**
   - Updated 2 relationship dropdowns (beneficiary add forms)
   - Removed "Other" option from both

3. **src/pages/admin/Members.tsx**
   - Updated relationship dropdown in the beneficiary form
   - Removed "Other" option

4. **src/pages/admin/Events.tsx**
   - Updated relationship dropdown for event-related beneficiaries
   - Removed "Other Relative" option

## Backend Support

The application already had full support for "next_of_kin" relationship type:
- Beneficiary grouping logic handles "next_of_kin" correctly
- Display labels map "next of kin" to "Next of Kin"
- Beneficiary cards render "Next of Kin" section properly

## Database Considerations

The `beneficiaries` table stores the relationship value in the `relationship` column. 

Existing entries with "other" or "sibling" relationships will remain unchanged in the database. If you want to clean up old data, you can:

```sql
-- Migrate sibling entries to next_of_kin
UPDATE beneficiaries 
SET relationship = 'next_of_kin' 
WHERE relationship = 'sibling';

-- Migrate other entries to next_of_kin (or another appropriate value)
UPDATE beneficiaries 
SET relationship = 'next_of_kin' 
WHERE relationship = 'other';
```

## Testing

Test the following scenarios:
1. Add a new beneficiary with each relationship type (Spouse, Child, Parent, Next of Kin)
2. Verify each appears in the correct section on the beneficiary list
3. Verify the relationship displays correctly in all views
4. Test in member, secretary, and admin dashboards
5. Verify no "Other" option appears in any dropdown
