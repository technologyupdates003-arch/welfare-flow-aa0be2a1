# Event Close and Delete Functionality

## Overview
Updated the Events management page to allow admins to both close and delete events.

## Changes Made

### File: src/pages/admin/Events.tsx

#### 1. Added Delete Mutation
```typescript
const deleteEvent = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
    toast.success("Event deleted successfully");
  },
  onError: (e: any) => toast.error(e.message),
});
```

#### 2. Updated Imports
- Added `Trash2` icon from lucide-react for delete button

#### 3. Updated Actions Column
- **Close Button**: Closes active events (changes status to "closed")
  - Only shows for active events
  - Closed events still appear in admin view but marked as "closed"
  - Closed events disappear from member view
  
- **Delete Button**: Permanently deletes events
  - Always available (for both active and closed events)
  - Shows trash icon
  - Removes event completely from database
  - Cannot be undone

## User Experience

### For Admins
- **Close Event**: Temporarily close an event without deleting it
  - Event remains in database
  - Event disappears from member view
  - Can be reopened if needed (by changing status back to active)
  
- **Delete Event**: Permanently remove an event
  - Event is completely removed from database
  - Cannot be recovered
  - Useful for removing duplicate or incorrect events

### For Members
- Closed events automatically disappear from their view
- Deleted events are gone permanently

## Actions Available

| Status | Close Button | Delete Button |
|--------|-------------|---------------|
| Active | ✅ Yes | ✅ Yes |
| Closed | ❌ No | ✅ Yes |

## Testing Checklist

- [ ] Create a test event
- [ ] Click "Close" button - event should disappear from member view
- [ ] Verify event still shows in admin view with "closed" status
- [ ] Click "Delete" button on a closed event - event should be removed completely
- [ ] Verify deleted event no longer appears in admin view
- [ ] Test delete on an active event - should work
- [ ] Verify member cannot see closed or deleted events

## Notes

- Closing an event is reversible (can change status back to active)
- Deleting an event is permanent and cannot be undone
- Both operations trigger a toast notification
- Delete button is always available for all event statuses
