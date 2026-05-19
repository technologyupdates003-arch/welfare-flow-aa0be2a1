# Beneficiary Form Update - Seamless Integration with Import

## Overview
Updated the beneficiary request form to match the Excel import schema and add conditional validation for Next of Kin beneficiaries.

## Changes Made

### File: src/pages/member/MemberBeneficiaries.tsx

#### 1. Schema Alignment
The form now matches the beneficiary import schema:
- **Name**: Full name (required)
- **Relationship**: Spouse, Child, Parent, Next of Kin (required)
- **Phone**: Optional for most relationships, **required for Next of Kin**
- **ID Number**: Optional for most relationships, **required for Next of Kin**
- **Reason**: Explanation for adding beneficiary (required)

#### 2. Conditional Field Validation
- **Phone & ID Number**: 
  - Optional for Spouse, Child, Parent
  - **Required** when relationship is "Next of Kin"
  - Labels dynamically show "*" when required
  - Placeholder text changes based on relationship type

#### 3. User Feedback
- Warning message appears when Next of Kin is selected but phone/ID are missing
- Submit button is disabled until all required fields are filled
- Clear indication of which fields are required

## Form Behavior

### For Spouse, Child, Parent:
```
Name: [required]
Relationship: [required]
Phone: [optional]
ID Number: [optional]
Reason: [required]
```

### For Next of Kin:
```
Name: [required]
Relationship: [required]
Phone: [REQUIRED] ⚠️
ID Number: [REQUIRED] ⚠️
Reason: [required]
```

## Seamless Integration with Import

The form now works seamlessly with the Excel import:

1. **Import Process**: Excel file imports beneficiaries with all fields (name, relationship, phone, ID)
2. **Manual Addition**: Members can add beneficiaries through the form
3. **Consistent Schema**: Both paths use the same database schema
4. **Validation**: Form enforces the same requirements as import

## Benefits

✅ **Consistency**: Form and import use identical schema
✅ **Data Quality**: Required fields for Next of Kin ensure complete information
✅ **User Experience**: Clear indication of required fields
✅ **Flexibility**: Phone and ID optional for other relationships
✅ **Validation**: Prevents incomplete Next of Kin entries

## Testing Checklist

- [ ] Add Spouse beneficiary - phone and ID should be optional
- [ ] Add Child beneficiary - phone and ID should be optional
- [ ] Add Parent beneficiary - phone and ID should be optional
- [ ] Select Next of Kin - phone and ID labels should show "*"
- [ ] Try to submit Next of Kin without phone - button should be disabled
- [ ] Try to submit Next of Kin without ID - button should be disabled
- [ ] Fill all Next of Kin fields - button should be enabled
- [ ] Verify warning message appears for incomplete Next of Kin
- [ ] Submit form and verify request is created with all fields

## Database Schema

The form submits to `beneficiary_requests` table with:
```typescript
{
  member_id: string;
  request_type: "add";
  beneficiary_name: string;
  beneficiary_relationship: string;
  beneficiary_phone: string | null;
  beneficiary_id_number: string | null;
  reason: string;
  status: "pending";
}
```

When approved, it creates a `beneficiaries` record with the same fields.
