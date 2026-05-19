# Beneficiary Name Capitalization Fix

## Problem
Beneficiary names were displaying inconsistently - some names like "Kevin Wanjal Sifuna" were showing in lowercase or mixed case instead of proper title case where each word starts with an uppercase letter.

## Solution
Added a `capitalizeNames()` utility function that properly capitalizes each word in a name.

## Implementation

### Utility Function
```typescript
const capitalizeNames = (name: string): string => {
  if (!name) return "";
  return name
    .split(/\s+/)
    .map(word => {
      if (word.length === 0) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
};
```

### How It Works
1. Splits the name by whitespace
2. Capitalizes the first letter of each word
3. Converts the rest to lowercase
4. Joins back with spaces

### Examples
- `"kevin wanjal sifuna"` → `"Kevin Wanjal Sifuna"`
- `"JOHN DOE"` → `"John Doe"`
- `"mary jane watson"` → `"Mary Jane Watson"`
- `"jean-paul sartre"` → `"Jean-paul Sartre"` (note: hyphens not split)

## Files Updated

### 1. src/pages/admin/Beneficiaries.tsx
- Added `capitalizeNames()` function
- Applied to beneficiary name display in table
- Applied to member name display in table

### 2. src/pages/member/MemberBeneficiaries.tsx
- Added `capitalizeNames()` function
- Updated `formatBeneficiaryName()` to use capitalization
- Applied to beneficiary request display

## Display Locations Fixed

✅ **Admin Beneficiaries Dashboard**
- Beneficiary name column
- Member name column

✅ **Member Beneficiaries Page**
- Beneficiary cards display
- Beneficiary request display

## Testing Checklist

- [ ] View admin beneficiaries dashboard - all names should be properly capitalized
- [ ] Search for beneficiaries - names should display with proper capitalization
- [ ] View member beneficiaries page - all names should be properly capitalized
- [ ] Check beneficiary requests - names should be properly capitalized
- [ ] Test with various name formats (lowercase, uppercase, mixed case)
- [ ] Verify multi-word names are all capitalized (e.g., "Kevin Wanjal Sifuna")

## Notes

- The function handles multi-word names correctly
- Empty strings are handled gracefully
- The function preserves spacing between words
- Hyphenated names are treated as single words (e.g., "Jean-paul" not "Jean-Paul")
- The function is applied at display time, not stored in database (preserves original data)
