# WMS API CORS Configuration Guide

## Current Status

**Error:** `Failed to fetch` when connecting to WMS API
**Cause:** CORS (Cross-Origin Resource Sharing) not properly configured between the welfare app and WMS API

## Error Message Details

The enhanced error handler now shows:
```
Unable to reach the Welfare Management System. This is usually a CORS or network issue. 
Verify VITE_WMS_API_BASE and that the API allows this origin. (Failed to fetch)
```

**Error Code:** `CORS_OR_NETWORK`  
**Status:** 0 (fetch failed before reaching the server)

## Root Cause Analysis

The error occurs because:
1. **CORS not configured on WMS API** - The backend doesn't allow requests from `welfare.neibasconsortium.co.ke`
2. **Invalid endpoint** - `VITE_WMS_API_BASE` points to non-existent or misconfigured endpoint
3. **Network connectivity** - The API server is unreachable

## Solution 1: Supabase Functions Setup (Recommended)

If using Supabase Functions:

### Step 1: Deploy WMS Functions

Create the following functions in your Supabase project:

**`functions/members/index.ts`**
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  // Enable CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    }})
  }

  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
    
    if (error) throw error
    
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
```

### Step 2: Configure Environment

In your `.env` file:
```
VITE_WMS_API_BASE="https://ubdhljxyleqsixrewtto.supabase.co/functions/v1"
```

### Step 3: Enable CORS in Supabase

1. Go to Supabase Dashboard → Project Settings → Configurations
2. Add CORS origin: `https://welfare.neibasconsortium.co.ke`
3. Or allow all origins temporarily for testing: `*`

---

## Solution 2: External API Server Setup

If using an external WMS server:

### For Node.js/Express:

```typescript
import cors from 'cors';
import express from 'express';

const app = express();

// Enable CORS
app.use(cors({
  origin: ['https://welfare.neibasconsortium.co.ke', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Your routes
app.get('/api/members', (req, res) => {
  res.json({ members: [] });
});

app.listen(3000);
```

### For Python/Flask:

```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

CORS(app, 
     origins=['https://welfare.neibasconsortium.co.ke', 'http://localhost:5173'],
     supports_credentials=True)

@app.route('/api/members', methods=['GET'])
def get_members():
    return {'members': []}
```

### For .NET/ASP.NET Core:

```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(builder =>
    {
        builder
            .WithOrigins("https://welfare.neibasconsortium.co.ke", "http://localhost:5173")
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

app.UseCors();
```

### Update `.env`:

```
VITE_WMS_API_BASE="https://wms.yourdomain.com/api"
```

---

## Solution 3: Local Development Setup

For testing locally:

### Step 1: Start a test WMS server

```bash
# Terminal 1: Start WMS mock server
npm install -g http-server
echo '{"members": []}' > api.json
http-server --cors -p 3001
```

### Step 2: Update `.env`

```
VITE_WMS_API_BASE="http://localhost:3001"
```

### Step 3: Verify with curl

```bash
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:3001/api/members -v
```

---

## Debugging Checklist

### 1. Verify API Endpoint

```bash
# Test if endpoint is reachable
curl -I https://ubdhljxyleqsixrewtto.supabase.co/functions/v1/health
```

**Expected:** Status 200 or 404 (not connection refused)

### 2. Check CORS Headers

```bash
curl -H "Origin: https://welfare.neibasconsortium.co.ke" \
     -H "Access-Control-Request-Method: GET" \
     https://ubdhljxyleqsixrewtto.supabase.co/functions/v1/members -v
```

**Expected Response Headers:**
```
Access-Control-Allow-Origin: https://welfare.neibasconsortium.co.ke
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type
```

### 3. Check Browser Console

Open DevTools (F12) → Network tab:
- Look for failed requests to WMS API
- Check Response headers for CORS errors
- Look for error messages in Console tab

### 4. Enable Debug Logging

The WMS API module now includes detailed logging:

```typescript
// In src/lib/wms-api.ts - already enabled
console.log('[WMS API]', 'Calling:', url);
console.log('[WMS API]', 'Response:', response.status, response.statusText);
console.log('[WMS API]', 'Error:', error.message);
```

Check browser console for these debug messages.

---

## Testing the WMS API

Once CORS is configured, test with this in browser console:

```javascript
import { checkWmsHealth, getMemberFromWms } from './src/lib/wms-api';

// Test health
checkWmsHealth().then(isHealthy => {
  console.log('WMS Health:', isHealthy);
});

// Test member fetch
getMemberFromWms('123').then(member => {
  console.log('Member:', member);
}).catch(err => {
  console.error('Error:', err);
});
```

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| `Failed to fetch` | Check CORS headers, ensure endpoint is reachable |
| `OPTIONS 404` | WMS API doesn't handle preflight requests, add OPTIONS handler |
| `Missing Authorization` | Add `Authorization` header to CORS `allowedHeaders` |
| `Connection refused` | Verify API server is running and accessible |
| `Certificate error` | Use HTTPS in production, ensure SSL certificates are valid |

---

## Integration Points

Once CORS is working, integrate WMS in these components:

1. **[src/pages/beneficiary/BeneficiaryDashboard.tsx](src/pages/beneficiary/BeneficiaryDashboard.tsx)**
   - Use `getMemberFromWms()` to fetch member details
   - Use `getContributionsFromWms()` for contribution history

2. **[src/pages/treasurer/TreasurerDashboard.tsx](src/pages/treasurer/TreasurerDashboard.tsx)**
   - Use `getContributionsFromWms()` for financial reports
   - Use `getBenefitsFromWms()` for payout tracking

3. **[src/pages/admin/MemberManagement.tsx](src/pages/admin/MemberManagement.tsx)**
   - Use `syncMemberToWms()` to sync new members
   - Use `updateMemberInWms()` for member updates

4. **[src/lib/member-registration.ts](src/lib/member-registration.ts)**
   - Call `syncMemberToWms()` after successful Supabase registration

---

## Quick Fix Checklist

- [ ] Verify WMS API endpoint is correct in `.env`
- [ ] Test endpoint with curl to confirm it's reachable
- [ ] Check CORS headers are present in response
- [ ] Add origin to CORS allowlist on WMS API
- [ ] Clear browser cache (Ctrl+Shift+Delete)
- [ ] Restart dev server (Ctrl+C, then `npm run dev`)
- [ ] Check browser console for detailed error messages
- [ ] Try incognito/private window to avoid cache issues
- [ ] Test in production after deployment

---

## Need Help?

1. **Check error message** - The enhanced error handler now shows whether it's CORS or network issue
2. **Review console logs** - Look for [WMS API] debug messages
3. **Test endpoint directly** - Use curl or Postman to verify API works
4. **Enable CORS on backend** - Ensure server returns proper CORS headers
5. **Contact WMS provider** - If using external system, ask them to whitelist your domain

---

## API Endpoints Reference

Once integrated, these endpoints should be available:

```
GET    /members              - List all members
GET    /members/{id}         - Get member details
POST   /members              - Create member
PUT    /members/{id}         - Update member

GET    /contributions        - List contributions
GET    /contributions/{id}   - Get member contributions
POST   /contributions        - Record contribution

GET    /benefits             - List benefits
GET    /benefits/{id}        - Get member benefits
POST   /benefits/payout      - Process payout

GET    /health              - Health check
```

---

## Deployment

Once CORS is configured:

1. Run: `npm run build`
2. Deploy `dist/` folder to production
3. Verify CORS headers in production network requests
4. Monitor browser console for WMS API errors
5. Test member sync and data retrieval

---

**Last Updated:** 2026-06-09  
**Version:** 2.0 (CORS Support)
