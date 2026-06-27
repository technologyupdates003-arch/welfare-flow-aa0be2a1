# cPanel Deployment Guide - Welfare Flow

**Build Date**: June 27, 2026  
**Build Status**: ✅ Ready for cPanel Deployment  
**Package Files**: 
- `welfare-flow-dist-latest.zip` (3.9 MB)
- `welfare-flow-dist-20260627-043856.zip` (3.9 MB)

**Location**: ~/Downloads/

---

## 📋 Pre-Deployment Checklist

- [ ] Downloaded deployment package to your computer
- [ ] Have cPanel login credentials ready
- [ ] Know your cPanel domain/website path
- [ ] Backup current website (optional but recommended)
- [ ] Have at least 50MB free space in cPanel

---

## 🚀 Step-by-Step cPanel Deployment

### Step 1: Login to cPanel

1. Open browser and navigate to: `your-domain.com:2083`
2. Enter cPanel username and password
3. Click "Log in"

---

### Step 2: Upload the Deployment Package

**Method A: Using File Manager (Easiest)**

1. In cPanel, click **"File Manager"**
2. Navigate to **public_html** folder (this is your website root)
3. If there's existing content:
   - Create a backup folder: Right-click → "Rename" → rename to `public_html_backup_$(date)`
   - OR delete old files (only if you're sure)
4. Click **"Upload"** button
5. Select `welfare-flow-dist-latest.zip` from your Downloads
6. Wait for upload to complete (shows 100%)

**Method B: Using FTP**

1. In cPanel, go to **FTP Accounts** or **FTP Connections**
2. Note your FTP credentials
3. Use FTP client (FileZilla, WinSCP, etc.)
4. Connect to your server
5. Navigate to `public_html`
6. Upload `welfare-flow-dist-latest.zip`

---

### Step 3: Extract the ZIP File

1. In **File Manager** (cPanel), locate `welfare-flow-dist-latest.zip`
2. Right-click on it → **"Extract"**
3. Choose destination: **Keep in same folder** (public_html)
4. Click **"Extract File(s)"**
5. Wait for extraction to complete

---

### Step 4: Move Files to Public HTML

After extraction, you'll have a `dist` folder. Move its contents to public_html:

1. Open the `dist` folder
2. Select all files inside: **Ctrl+A** (or **Cmd+A** on Mac)
3. Cut the files: **Ctrl+X**
4. Navigate back to `public_html`
5. Paste files: **Ctrl+V**
6. Delete the now-empty `dist` folder

**Result**: Your public_html should now contain:
- index.html
- assets/ (folder)
- favicon.png
- manifest.json
- .htaccess
- robots.txt
- etc.

---

### Step 5: Configure .htaccess (Already Included)

The `.htaccess` file is already included in the deployment package. It handles:
- URL routing (React Router support)
- Caching headers
- Compression

**If you need to modify it manually:**

1. In File Manager, locate `.htaccess`
2. Right-click → **"Edit"** (or open in text editor)
3. The file should contain routing rules
4. Save changes

---

### Step 6: Clear Cache and Test

1. In cPanel home, look for **"Clear All Caches"** or go to **CPanel → Cache Manager**
2. Click to clear all caches
3. Close browser and clear browser cache:
   - **Chrome**: Ctrl+Shift+Delete
   - **Mac**: Cmd+Shift+Delete
4. Open your website URL in a new browser window

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Website loads without errors
- [ ] Login page appears correctly
- [ ] Styling (colors, fonts) looks correct
- [ ] Images load properly
- [ ] No 404 errors in browser console (F12)
- [ ] Can login with test credentials:
  - Phone: +254721294219
  - Password: Member2026
- [ ] Member dashboard shows data (not blank)
- [ ] No console errors (F12 → Console tab)

---

## 🔍 Testing the Deployment

### Test 1: Check Website Loads
```
1. Navigate to your-domain.com
2. Should see login page
3. CSS/styling should be applied
4. Images should load
```

### Test 2: Check Console for Debug Logs
```
1. Press F12 to open DevTools
2. Go to Console tab
3. Login as +254721294219 / Member2026
4. Look for logs:
   [AUTH DEBUG] fetchMemberId called...
   [MemberDashboard] Current memberId...
5. These indicate debug logging is active
```

### Test 3: Test Member Login
```
1. Navigate to login page
2. Enter: +254721294219
3. Password: Member2026
4. Click Login
5. Should redirect to dashboard
6. Check if member data displays
```

---

## 🐛 Troubleshooting

### Issue: Blank White Screen
**Causes**: 
- Files not extracted properly
- Wrong folder uploaded
- .htaccess issues

**Solutions**:
1. Verify all files are in public_html (not in dist/ subfolder)
2. Check that index.html exists in public_html
3. Try renaming .htaccess temporarily, then test
4. Check Error logs (cPanel → Error logs)

### Issue: 404 Errors
**Causes**: 
- Routing not working
- .htaccess not configured

**Solutions**:
1. Verify .htaccess is present and not corrupted
2. Check cPanel error logs for clues
3. Ensure index.html rewrite rules are in .htaccess

### Issue: Assets Not Loading (No CSS/Images)
**Causes**:
- File permissions wrong
- Files in wrong folder
- Cache issue

**Solutions**:
1. Check file permissions (should be 644 for files, 755 for folders)
2. Verify assets/ folder is in public_html
3. Hard refresh browser (Ctrl+Shift+R)
4. Clear cPanel cache

### Issue: Login Page Appears but Can't Login
**Causes**:
- Database not accessible
- Supabase URL/key wrong
- Network issue

**Solutions**:
1. Check browser console (F12 → Console)
2. Look for network errors or CORS issues
3. Verify Supabase credentials in environment
4. Contact support with console errors

### Issue: Dashboard Shows but No Data (All Zeros)
**This is expected** - This is the issue we're diagnosing! Follow the testing guide in QUICK_DIAGNOSIS_FLOWCHART.md

---

## 📁 Expected File Structure After Deployment

```
public_html/
├── index.html              ← Main entry point
├── favicon.png
├── manifest.json
├── .htaccess              ← Routing configuration
├── robots.txt
├── placeholder.svg
├── khcww-stamp.png
├── sw.js                  ← Service worker
├── vercel.json
├── _redirects
└── assets/                ← All CSS, JS, images
    ├── index-CNQaIVOA.css
    ├── index-CxYBML_U.js
    └── [other asset files]
```

---

## ⚙️ Advanced Configuration

### Enable Gzip Compression
In .htaccess, add:
```apache
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript
</IfModule>
```

### Set Cache Headers
In .htaccess, add:
```apache
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/html "access 1 day"
  ExpiresByType text/css "access 1 month"
  ExpiresByType application/javascript "access 1 month"
  ExpiresByType image/jpeg "access 1 month"
</IfModule>
```

### Enable HTTP/2
Contact your hosting provider or enable in cPanel → Apache Modules

---

## 🔒 Security Notes

- `.htaccess` includes rewrite rules for routing
- All files are minified and optimized
- No sensitive data in frontend code
- API keys should be in backend/environment only
- Consider HTTPS (should already be enabled)

---

## 📞 Support

### If Deployment Fails
1. Check cPanel Error Logs (cPanel → Error Logs)
2. Verify file permissions (644 for files, 755 for directories)
3. Try clearing cache
4. Contact hosting support with error details

### If Application Issues Persist
1. Open browser DevTools (F12)
2. Go to Console tab
3. Screenshot any errors
4. Share with support team along with:
   - Domain name
   - Error message
   - Steps to reproduce

---

## 🎯 Quick Reference Commands (For cPanel Terminal)

If you have SSH access, you can use these commands:

```bash
# Check file permissions
ls -la ~/public_html/ | head -20

# Extract zip directly
cd ~/public_html
unzip welfare-flow-dist-latest.zip
mv dist/* .
rm -rf dist

# Set correct permissions
chmod 644 ~/public_html/*
chmod 755 ~/public_html/assets
find ~/public_html -type d -exec chmod 755 {} \;

# Verify structure
ls -la ~/public_html/ | grep -E "index|assets|.htaccess"
```

---

## 📊 File Sizes

| Item | Size |
|------|------|
| Total Package | 3.9 MB |
| Main JS Bundle | 3.9 MB |
| CSS Bundle | 126 KB |
| Images | ~1.6 MB |
| Other assets | ~1.3 MB |

---

## ✨ Deployment Complete Checklist

After following all steps above:

- [ ] All files uploaded to public_html
- [ ] ZIP file extracted successfully
- [ ] Website loads at your domain
- [ ] Login page displays correctly
- [ ] No 404 or 500 errors
- [ ] Debug logs appear in console (F12)
- [ ] Test member can login
- [ ] Ready for bug testing

---

## Next Steps

1. **Deploy** using steps above
2. **Test** using verification checklist
3. **Debug** if needed using QUICK_DIAGNOSIS_FLOWCHART.md
4. **Report** console logs if issues persist

---

**Deployment Package Created**: June 27, 2026  
**Ready to Deploy**: ✅ Yes

Good luck! 🚀
