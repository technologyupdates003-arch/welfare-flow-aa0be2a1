# Quick Start Guide

## 1. Setup Supabase (5 minutes)
1. Go to https://supabase.com and create a project
2. Wait for project to be ready
3. Go to SQL Editor
4. Run all files from 'supabase/migrations/' folder in order
5. Go to Storage and create buckets: 'signatures' and 'documents'

## 2. Configure Environment (2 minutes)
1. Copy .env.example to .env
2. Get your Supabase URL and Anon Key from Settings -> API
3. Update .env with your credentials

## 3. Deploy Frontend (5 minutes)

### Option A: Vercel (Easiest)
1. Go to https://vercel.com
2. Click "New Project"
3. Upload the 'dist' folder
4. Add environment variables from .env
5. Deploy!

### Option B: Netlify
1. Go to https://netlify.com
2. Drag and drop the 'dist' folder
3. Add environment variables
4. Done!

## 4. Initial Setup (3 minutes)
1. Open your deployed site
2. Register first user
3. Go to Supabase Dashboard -> Authentication -> Users
4. Find your user in the users table
5. Go to Table Editor -> user_roles
6. Add a row: user_id = your_user_id, role = 'super_admin'
7. Refresh your app and login

## 5. You're Done! ??
- Login as super admin
- Create admin users
- Start managing your welfare group

## Need Help?
- Check DEPLOYMENT_GUIDE.md for detailed instructions
- Review FEATURES_SUMMARY.md for all features
- Check Supabase logs for errors
