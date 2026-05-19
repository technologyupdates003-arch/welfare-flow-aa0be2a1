# Charts with Time Filtering & Voice Chat Implementation Plan

## Feature 1: Charts with Time Filtering (Today/Yesterday)

### Overview
Add time-based filtering to existing charts to show data for specific periods.

### Implementation Approach

#### 1. Time Filter Component
- Create a reusable time filter component with buttons:
  - Today
  - Yesterday
  - Last 7 Days
  - Last 30 Days
  - Custom Range

#### 2. Chart Updates Needed
- **Treasurer Dashboard**: Income vs Expenses chart
- **Admin Dashboard**: Contributions chart
- **Super Admin Dashboard**: System metrics

#### 3. Database Queries
Update queries to filter by date range:
```typescript
const startDate = new Date();
startDate.setHours(0, 0, 0, 0);

const { data } = await supabase
  .from("contributions")
  .select("*")
  .gte("created_at", startDate.toISOString())
  .lte("created_at", new Date().toISOString());
```

#### 4. Files to Modify
- `src/pages/treasurer/TreasurerDashboard.tsx`
- `src/pages/admin/Dashboard.tsx`
- `src/pages/super-admin/SuperAdminDashboard.tsx`

---

## Feature 2: Voice Chat (WhatsApp-like)

### Overview
Add real-time voice messaging capability similar to WhatsApp.

### Technology Stack Required
- **WebRTC**: For peer-to-peer audio
- **Supabase Realtime**: For signaling
- **Web Audio API**: For recording/playback
- **Socket.io or Supabase Realtime**: For message delivery

### Implementation Components

#### 1. Voice Message Recording
- Record audio using Web Audio API
- Store as blob/file
- Upload to Supabase Storage

#### 2. Voice Message Playback
- Retrieve from storage
- Play with audio controls
- Show duration and playback progress

#### 3. Real-time Messaging
- Create `voice_messages` table
- Track sender, recipient, timestamp
- Delivery status (sent, delivered, read)

#### 4. UI Components
- Voice message input button (hold to record)
- Voice message display with play button
- Recording timer
- Playback progress bar

#### 5. Database Schema
```sql
CREATE TABLE voice_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  recipient_id UUID NOT NULL REFERENCES auth.users(id),
  audio_url TEXT NOT NULL,
  duration_seconds INT,
  status TEXT DEFAULT 'sent', -- sent, delivered, read
  created_at TIMESTAMPTZ DEFAULT now(),
  listened_at TIMESTAMPTZ
);
```

#### 6. Storage Setup
- Create `voice-messages` bucket in Supabase Storage
- Set up RLS policies for access control

### Files to Create
- `src/components/chat/VoiceMessageInput.tsx`
- `src/components/chat/VoiceMessageDisplay.tsx`
- `src/pages/chat/ChatPage.tsx` (or integrate into existing chat)
- `src/lib/voiceChat.ts` (utilities)

---

## Implementation Priority

### Phase 1: Charts with Time Filtering (Easier, Faster)
- Estimated: 2-3 hours
- Impact: High (improves data visibility)
- Complexity: Low-Medium

### Phase 2: Voice Chat (Complex, Time-consuming)
- Estimated: 8-12 hours
- Impact: High (new communication feature)
- Complexity: High

---

## Challenges & Considerations

### Charts
- ✅ Straightforward implementation
- ✅ Uses existing data
- ✅ No new dependencies needed

### Voice Chat
- ⚠️ Requires WebRTC setup
- ⚠️ Browser permissions needed (microphone)
- ⚠️ Audio encoding/compression
- ⚠️ Storage costs for audio files
- ⚠️ Real-time synchronization
- ⚠️ Mobile compatibility
- ⚠️ Network bandwidth considerations

---

## Recommended Approach

### For Charts (Implement First)
1. Create time filter component
2. Update Treasurer Dashboard chart
3. Add to Admin Dashboard
4. Test with various date ranges

### For Voice Chat (Implement Second)
1. Set up database schema
2. Create Supabase Storage bucket
3. Build recording component
4. Build playback component
5. Integrate into chat interface
6. Test on different browsers/devices

---

## Dependencies to Add

### For Voice Chat
```json
{
  "simple-peer": "^9.11.1",
  "recordrtc": "^5.4.9",
  "wavesurfer.js": "^6.3.0"
}
```

Or use native Web Audio API (no dependencies needed).

---

## Next Steps

1. **Confirm Priority**: Which feature should be implemented first?
2. **Scope Clarification**: 
   - For charts: Which dashboards need time filtering?
   - For voice chat: Should it be 1-on-1 or group chat?
3. **Timeline**: What's the deadline?
4. **Resources**: Any specific requirements or constraints?
