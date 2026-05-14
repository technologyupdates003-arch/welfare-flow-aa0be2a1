# Welfare Flow - Complete Deployment Guide

## 📋 Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Database Setup](#database-setup)
3. [Build & Deployment](#build--deployment)
4. [Post-Deployment Testing](#post-deployment-testing)
5. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### ✅ Code Quality
- [x] Build successful (41.62s)
- [x] No TypeScript errors
- [x] All imports resolved
- [x] 3089 modules transformed
- [x] Production bundle ready

### ✅ Features Verified
- [x] Treasurer dashboard with real data
- [x] Member contributions tracking
- [x] Memo creation with PDF download
- [x] Chat sharing functionality
- [x] Floating chat integration
- [x] News/Events schedule fields
- [x] AI assistants functional

### ✅ Environment
- [x] Node.js installed
- [x] npm dependencies installed
- [x] Supabase project configured
- [x] Environment variables ready

---

## Database Setup

### Step 1: Apply Migrations

Run these migrations in your Supabase dashboard (SQL Editor):

#### Migration 1: Schedule Fields for News & Events
```sql
-- File: supabase/migrations/20260429_add_schedule_fields_to_news_events.sql
-- Add scheduled_date, rescheduled_date, reschedule_reason to news and events tables
```

#### Migration 2: Fix Members RLS
```sql
-- File: supabase/migrations/20260429_fix_members_rls_for_treasurer.sql
-- Update RLS policies for treasurer access to members
```

#### Migration 3: Get Members with Roles Function
```sql
-- File: supabase/migrations/20260429_get_members_with_roles.sql
-- Create function to fetch members with roles
```

### Step 2: Verify Tables

Check that these tables exist and have correct columns:

```sql
-- Verify members table
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'members' 
ORDER BY ordinal_position;

-- Verify news table has schedule fields
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'news' AND column_name LIKE '%schedule%';

-- Verify events table has schedule fields
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'events' AND column_name LIKE '%schedule%';
```

### Step 3: Verify RLS Policies

```sql
-- Check members table RLS
SELECT * FROM pg_policies WHERE tablename = 'members';

-- Check notifications table exists
SELECT * FROM information_schema.tables WHERE table_name = 'notifications';
```

---

## Build & Deployment

### Step 1: Final Build

```bash
# Clean build
npm run build

# Expected output:
# ✓ 3089 modules transformed
# ✓ built in ~40s
```

### Step 2: Deploy to Hosting

#### Option A: Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel deploy dist/ --prod

# Verify deployment
vercel env list
```

#### Option B: Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist

# Verify deployment
netlify status
```

#### Option C: Traditional Hosting (AWS S3, etc.)
```bash
# Upload dist folder
aws s3 sync dist/ s3://your-bucket-name --delete

# Set cache headers
aws s3 cp s3://your-bucket-name s3://your-bucket-name \
  --recursive \
  --exclude "*" \
  --include "*.html" \
  --metadata-directive REPLACE \
  --cache-control "max-age=0, no-cache, no-store, must-revalidate"
```

### Step 3: Configure Environment

Set these environment variables in your hosting platform:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Post-Deployment Testing

### Test 1: Treasurer Dashboard
```
1. Navigate to /treasurer
2. Verify dashboard loads
3. Check member count displays correctly
4. Verify AI Financial Advisor button works
```

### Test 2: Member Contributions
```
1. Go to /treasurer/contributions
2. Verify members list loads with real data
3. Check status badges (Active, Warning, Defaulter, Suspended)
4. Test AI Assistant button
5. Verify search and filter work
```

### Test 3: Create Memo
```
1. Go to /treasurer/memos (or create new)
2. Fill in memo details
3. Test "All Members" recipient option
4. Test "Executives Only" option
5. Test "Custom Selection" option
6. Click "Download PDF" - should open print dialog
7. Click "Send Notification" - should show success
8. Click "Share to Welfare Chat" - should show success
```

### Test 4: News & Events Schedule
```
1. Go to /admin/news
2. Create/edit news item
3. Verify scheduled_date field appears
4. Verify rescheduled_date field appears
5. Verify reschedule_reason field appears
6. Repeat for /admin/events
```

### Test 5: Floating Chat
```
1. Navigate to any treasurer page
2. Look for floating chat bubble in bottom-right
3. Click to open chat
4. Verify chat loads and functions
```

### Test 6: Performance
```
1. Open DevTools (F12)
2. Go to Network tab
3. Reload page
4. Check:
   - Total load time < 3 seconds
   - JS bundle loads < 2 seconds
   - No 404 errors
   - All assets load successfully
```

---

## Troubleshooting

### Issue: Build Fails
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Issue: Members Not Loading
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'members';

-- Verify user has access
SELECT * FROM members LIMIT 1;
```

### Issue: Memo PDF Not Downloading
- Check browser console for errors
- Verify print dialog opens
- Try different browser

### Issue: Chat Not Appearing
- Verify FloatingChatBubble component imported
- Check browser console for errors
- Verify chat table exists in database

### Issue: Notifications Not Sending
```sql
-- Verify notifications table
SELECT * FROM information_schema.tables WHERE table_name = 'notifications';

-- Check RLS on notifications
SELECT * FROM pg_policies WHERE tablename = 'notifications';
```

### Issue: Schedule Fields Not Showing
```sql
-- Verify columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'news' AND column_name LIKE '%schedule%';
```

---

## Performance Optimization

### Current Bundle Size
- **JS**: 2,141.24 kB (589.91 kB gzipped)
- **CSS**: 98.10 kB (16.27 kB gzipped)
- **Images**: 258.80 kB

### Recommendations for Future
1. **Code Splitting**: Split large components into separate chunks
2. **Lazy Loading**: Load routes on demand
3. **Image Optimization**: Use WebP format
4. **Caching**: Implement service worker
5. **CDN**: Use CDN for static assets

---

## Rollback Plan

If deployment has issues:

```bash
# Rollback to previous version
vercel rollback  # For Vercel
# OR
netlify deploy --prod --dir=dist  # For Netlify (redeploy previous)
```

---

## Monitoring

### Key Metrics to Monitor
- Page load time
- Error rate
- User engagement
- API response time
- Database query performance

### Logging
- Check browser console for errors
- Monitor Supabase logs
- Check hosting platform logs

---

## Support

### Common Questions

**Q: How do I update the app after deployment?**
A: Make changes locally, run `npm run build`, then redeploy the `dist/` folder.

**Q: How do I add new features?**
A: Follow the same development process, test locally, then deploy.

**Q: How do I handle database changes?**
A: Create new migrations in `supabase/migrations/`, test locally, then apply in production.

---

## Deployment Checklist (Final)

- [ ] All migrations applied
- [ ] Environment variables set
- [ ] Build successful
- [ ] Deployed to hosting
- [ ] All tests passed
- [ ] Performance acceptable
- [ ] Monitoring configured
- [ ] Team notified

---

**Deployment Date**: April 29, 2026  
**Status**: ✅ Ready for Production  
**Support**: Contact development team for issues
