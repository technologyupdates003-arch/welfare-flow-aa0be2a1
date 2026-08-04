# KHCWW Welfare — PHP / MariaDB backend (cPanel)

A complete, dependency-free PHP 8.1+ REST backend that mirrors the current cloud
backend (tables, auth, row-level security, triggers, storage, RPC functions).

**The live app is NOT connected to this backend.** It keeps running on the cloud
backend until you decide to switch. This folder is the migration target.

## 1. Create the database (phpMyAdmin)

1. cPanel → MySQL® Databases → the database `neibasco_welfare data` and user
   `neibasco_Deno` already exist; make sure the user has **ALL PRIVILEGES**.
2. phpMyAdmin → select the database → **Import** → `database/schema.sql`.
3. Import `database/seed.sql` (creates the super admin + wallet rows), then
   replace the placeholder password hash as noted at the bottom of that file.

## 2. Deploy the API

Upload the whole `php-backend` folder outside `public_html`, then point a
subdomain (e.g. `api.yourdomain.co.ke`) document root at `php-backend/public`.

Alternative (single domain): copy `php-backend` into `public_html/api` and use
`https://yourdomain.co.ke/api/public/`.

Credentials live in `php-backend/.env` (already filled in):

```
DB_HOST=localhost
DB_NAME=neibasco_welfare data
DB_USER=neibasco_Deno
DB_PASSWORD=Deno@26###
```

Before going live, change `JWT_SECRET`, set `APP_URL`, `STORAGE_PUBLIC_URL`,
`CORS_ORIGINS` (your app domain) and the M-Pesa / Talksasa keys.

Health check: `GET https://api.yourdomain.co.ke/health` → `{"status":"ok","database":"connected"}`.

## 3. API surface

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/v1/token?grant_type=password` | Sign in with `{phone,password}` or `{email,password}` |
| `POST /auth/v1/token?grant_type=refresh_token` | Rotate the session |
| `POST /auth/v1/signup` | Create auth user + member profile |
| `GET /auth/v1/user` | Current user, roles and member profile |
| `POST /auth/v1/password` | Change own password |
| `POST /auth/v1/logout` | Revoke refresh tokens |
| `GET/POST/PATCH/DELETE /rest/v1/{table}` | CRUD, PostgREST-style filters |
| `POST /rest/v1/rpc/{fn}` | `has_role`, `get_member_login_activity`, `delete_member_safe`, `update_member_status`, `admin_reset_password`, `assign_user_role`, `increment`, `generate_memo_reference`, `get_members_with_roles` |
| `POST/GET/DELETE /storage/v1/object/{bucket}/{path}` | Files (`documents` private, others public) |

Filters match what the app already sends: `?status=eq.active&order=created_at.desc&limit=50`,
plus `neq, gt, gte, lt, lte, like, ilike, in, is, or`.

Every request is authenticated with `Authorization: Bearer <access_token>`.

## 4. Security model

`src/Policy.php` is the row-level-security equivalent — each table declares which
roles may read/write and which column scopes rows to the signed-in member
(`member_id` / `user_id`). Tables that are not listed are unreachable, so nothing
leaks by accident. Passwords are bcrypt, sessions are HS256 JWTs with rotating
refresh tokens.

`src/Hooks.php` reproduces the database triggers: UUID + timestamps, memo
reference numbers, wallet credit/debit on verified payments and completed
withdrawals, wallet-transaction running balances, and beneficiary-request
notifications.

## 5. Switching the frontend over (later)

Keep the app on the cloud backend until the data is copied. When you are ready,
create a small client that calls these endpoints and swap the import in
`src/integrations/supabase/client.ts` consumers — the request/response shapes are
intentionally identical to what the app receives today.
