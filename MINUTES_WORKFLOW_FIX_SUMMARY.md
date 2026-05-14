# Meeting Minutes Workflow Fix - Complete Implementation

**Date:** May 12, 2026  
**Issue:** Minutes submitted by vice secretary needed to be editable by secretary with auto-filled signatures and names for both secretary and chairperson

## Problem Statement
The workflow was incomplete:
- Vice Secretary could submit minutes to Secretary
- Secretary could only approve/reject without editing
- Signature fields were not being pre-filled for the secretary or chairperson
- No way to ensure names and signatures were populated before forwarding to chairperson

## Solution Implemented

### Changes Made to `src/pages/secretary/MinutesReview.tsx`

#### 1. **Added Edit Mode Capability**
- New state variables:
  - `editMode`: Boolean to toggle between view and edit modes
  - `editedMinute`: Stores the minute data being edited
- New handlers:
  - `handleEdit()`: Enter edit mode with current minute data
  - `handleSaveEdit()`: Save edited minute and auto-fill signatures
  - `handleCancelEdit()`: Exit edit mode without saving

#### 2. **Enhanced approveMutation**
Now fetches and auto-fills **both** secretary AND chairperson information:
```
Secretary Info:
- Secretary signature from office_bearer_signatures (role='secretary')
- Secretary name from members table (by user_id)

Chairperson Info:
- Chairperson signature from office_bearer_signatures (role='chairperson')
- Chairperson name from members table (by looking up chairperson role)
```

#### 3. **New updateMutation**
Handles minute edits and auto-fills all signature information:
- Allows secretary to edit: title, meeting_date, meeting_type, agenda, discussions, decisions, action_items
- Auto-fetches secretary signature and name
- Auto-fetches chairperson signature and name
- Updates meeting_minutes record with all pre-filled data

#### 4. **Updated Dialog UI**
Two modes:
- **View Mode**: Display-only, shows Review, Edit Minutes, Reject, and Approve buttons
- **Edit Mode**: Form fields for all editable content, shows Save & Pre-fill Info button

## Complete Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. VICE SECRETARY - Create & Submit                            │
├─────────────────────────────────────────────────────────────────┤
│ • Creates minutes in MinutesManagement.tsx                      │
│ • Submits with status: "submitted_to_secretary"                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. SECRETARY - Review & Edit (NEW FEATURE)                     │
├─────────────────────────────────────────────────────────────────┤
│ • Views submitted minutes in MinutesReview.tsx                  │
│ • Can now:                                                      │
│   ✓ Review minutes (read-only)                                 │
│   ✓ Edit minutes (NEW - click "Edit Minutes" button)          │
│   ✓ Save edits (updates with secretary & chairperson info)     │
│   ✓ Add review notes                                           │
│   ✓ Approve & Forward                                          │
│   ✓ Reject                                                     │
│                                                                 │
│ Auto-filled on Save or Approve:                                │
│   • secretary_name (from members.name where user_id=secretary) │
│   • secretary_signature_url (from office_bearer_signatures)    │
│   • chairperson_name (from user with chairperson role)         │
│   • chairperson_signature_url (from office_bearer_signatures)  │
│                                                                 │
│ Result Status: "secretary_reviewed"                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. CHAIRPERSON - Approve with Pre-filled Info                  │
├─────────────────────────────────────────────────────────────────┤
│ • Views minutes with status "secretary_reviewed"                │
│ • Sees pre-filled secretary info from secretary_reviewed        │
│ • Sees pre-filled chairperson name and signature                │
│ • Can upload new signature or use pre-filled one                │
│ • Updates with chairperson_signature_url and reviewed fields    │
│                                                                 │
│ Result Status: "approved"                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Database Fields Used

### meeting_minutes table:
- `secretary_name` - Auto-filled secretary's display name
- `secretary_signature_url` - Auto-filled secretary's signature image URL
- `chairperson_name` - Auto-filled chairperson's display name  
- `chairperson_signature_url` - Auto-filled chairperson's signature image URL
- `status` - Workflow status tracking

### office_bearer_signatures table:
- Stores signatures for: secretary, chairperson, etc.
- Used for auto-filling when secretary and chairperson approve

### members table:
- Contains `name` and `user_id` for lookup

### user_roles table:
- Used to find chairperson user_id by role

## Testing Checklist

- [x] Vice Secretary can create and submit minutes
- [x] Secretary receives minutes with status "submitted_to_secretary"
- [x] Secretary can edit minutes in review dialog
- [x] Secretary signature is auto-filled on save/approve
- [x] Secretary name is auto-filled on save/approve
- [x] Chairperson signature is auto-filled on save/approve
- [x] Chairperson name is auto-filled on save/approve
- [x] Minutes status updates to "secretary_reviewed" after secretary approval
- [x] Chairperson sees minutes with pre-filled info
- [x] Chairperson can approve and add own signature
- [x] Build compiles without errors

## Implementation Details

### Key Code Sections

**State Management:**
```typescript
const [editMode, setEditMode] = useState(false);
const [editedMinute, setEditedMinute] = useState<MinuteDetails | null>(null);
```

**Update Mutation (Signature Fetching):**
```typescript
// Fetch secretary signature and name
const { data: secretarySigRow } = await supabase
  .from("office_bearer_signatures")
  .select("signature_url")
  .eq("role", "secretary")
  .maybeSingle();

// Fetch chairperson signature and name (similar pattern)
// ...

// Update payload with all auto-filled fields
const updatePayload = {
  // ... other fields
  secretary_name: secretaryName,
  secretary_signature_url: secretarySigRow?.signature_url,
  chairperson_name: chairpersonName,
  chairperson_signature_url: chairpersonSigRow?.signature_url,
};
```

**Dialog Rendering:**
```typescript
{editMode && editedMinute ? (
  // Show edit form
) : selectedMinute ? (
  // Show view mode with edit button
) : null}
```

## User Experience Flow

1. **Vice Secretary** logs into dashboard
   - Creates new minutes form
   - Fills in meeting details, agenda, discussions, decisions, action items
   - Submits to secretary

2. **Secretary** logs in
   - Sees "Minutes Review" with pending count
   - Clicks "Review" on a minute
   - Can review the details
   - If needs edits, clicks "Edit Minutes" button
   - Edits content and clicks "Save & Pre-fill Info"
   - System auto-fills:
     - Secretary name and signature
     - Chairperson name and signature (retrieved from system)
   - Optionally adds review notes
   - Clicks "Approve & Forward" button
   - Minute forwarded to Chairperson with all info pre-filled

3. **Chairperson** logs in
   - Sees minutes in "Approve Meeting Minutes" section
   - Views minutes with all secretary and chairperson info already filled in
   - Can upload signature if not already done
   - Clicks approve to finalize

## Error Handling

- Toast notifications for success/failure
- Disabled buttons during mutation execution
- Fallback to email if member name not found
- Graceful handling of missing signatures

## Security Considerations

- Secretary can only edit minutes assigned to them
- Chairperson role verification happens server-side via user_roles
- All updates are tracked with secretary_reviewed_by and timestamps
- RLS policies enforce access control (not modified in this PR)

## Future Enhancements

- Add email notifications when minutes move between roles
- Add audit trail for minute edits
- Add version history for minutes
- Add bulk approve/reject functionality
- Add template fields for standard meeting elements
