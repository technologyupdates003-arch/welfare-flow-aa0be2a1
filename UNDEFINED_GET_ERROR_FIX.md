# Console Error Fix: Cannot read properties of undefined (reading 'get')

## Error Details
- **Location:** index-DUBIcWrH.js:52
- **Message:** Cannot read properties of undefined (reading 'get')
- **Cause:** Code attempting to call `.get()` on an undefined object

---

## Most Likely Causes

### 1. **Missing Environment Variables** ⚠️ HIGH PRIORITY
The Supabase client falls back to placeholder values if env vars are missing:

```bash
# Check .env file exists and has these variables:
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

**Fix:**
- Ensure `.env` file exists in project root
- Has both `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set
- Rebuild: `npm run build`

### 2. **React Query Cache Not Initialized**
Cache operations happening before provider loads.

**In [src/App.tsx](src/App.tsx), add cache error handling:**

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60 * 1000,
    },
  },
});

// Add error handling
queryClient.setDefaultOptions({
  queries: {
    retry: (failureCount, error) => {
      // Prevent retries if error is 401 or similar
      if (error instanceof Error && error.message.includes('undefined')) {
        return false;
      }
      return failureCount < 3;
    },
  },
});
```

### 3. **Supabase Client Initialization Error**

**In [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts), add better error handling:**

```tsx
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in your .env file.'
  );
}

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : null as any,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
```

### 4. **Undefined Map/Cache in Data Processing**

**Check for uninitialized Maps:**

Look for patterns like:
```tsx
// ❌ BAD - If data is undefined, sigMap could be undefined
const sigMap = new Map(data?.map(...) || []);
sigMap.get(key); // Might be undefined
```

**Should be:**
```tsx
// ✅ GOOD
const sigMap = new Map(data?.map(...) || []);
if (!sigMap) return null; // Guard
const value = sigMap.get(key) ?? defaultValue; // Fallback
```

---

## Step-by-Step Fix

### Step 1: Verify Environment Variables
```bash
# In project root, check .env file
cat .env

# Should contain:
# VITE_SUPABASE_URL=https://xxxxx.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=eyJxxxxx
```

### Step 2: Rebuild with Full Clean
```bash
# Clear everything and rebuild
rm -rf dist node_modules package-lock.json
npm install
npm run build
```

### Step 3: Update Supabase Client
Replace [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts) content with:

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Validate environment variables with helpful errors
if (!SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL is not set. Check your .env file.');
  throw new Error('Missing VITE_SUPABASE_URL in environment variables');
}

if (!SUPABASE_PUBLISHABLE_KEY) {
  console.error('❌ VITE_SUPABASE_PUBLISHABLE_KEY is not set. Check your .env file.');
  throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY in environment variables');
}

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : null as any,
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
      detectSessionInUrl: true,
    }
  }
);
```

### Step 4: Deploy with Environment Variables
When deploying, ensure your hosting platform has:
- `VITE_SUPABASE_URL` set
- `VITE_SUPABASE_PUBLISHABLE_KEY` set

**For cPanel/shared hosting:**
- Add to `.env` in the public_html directory
- Or set environment variables in cPanel → Environment Variables

**For Vercel/Netlify:**
- Project Settings → Environment Variables
- Add both variables with their values

### Step 5: Create New Deployment Package
```bash
npm run build
# Then zip the new dist folder
```

---

## Verification

After fixes, test:

1. **Open DevTools (F12)**
   - Console tab - should have no "Cannot read properties" errors
   - Check for error message about missing env vars

2. **Check Application Data**
   - Go to Application tab
   - Look at localStorage
   - Should have auth session data

3. **Try Login**
   - Login should work without errors
   - Navigate to different pages

---

## Still Having Issues?

Check these in order:

1. **Browser Console** - Look above the error for initial error messages
2. **Network Tab** - See if Supabase API calls are failing (404, 401, etc.)
3. **Supabase Status** - Check https://status.supabase.com
4. **Environment Variables** - `echo $VITE_SUPABASE_URL` in terminal to verify

---

## Quick Checklist

- [ ] `.env` file exists with correct Supabase credentials
- [ ] `VITE_SUPABASE_URL` starts with `https://`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` is not empty
- [ ] Ran `npm run build` after setting env vars
- [ ] Deployed new dist folder
- [ ] Hard refreshed browser (Ctrl+Shift+R or Cmd+Shift+R)
