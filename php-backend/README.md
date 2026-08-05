# KHCWW Welfare — PHP / MariaDB backend (cPanel, same-folder deployment)

Domain: **https://welafarewebsit.neibasconsortium.co.ke**
Frontend and backend live in the **same** `public_html` folder — no `api.` subdomain,
no cross-origin requests.

```
public_html/
├── index.html, assets/, sw.js …   ← React build (dist)
├── .htaccess                      ← copy of php-backend/deploy/root.htaccess
└── api/                           ← the whole php-backend folder
    ├── index.php                  ← front controller  (/api/...)
    ├── .htaccess
    ├── .env                       ← DB + JWT + M-Pesa + SMS credentials
    ├── src/                       (denied over HTTP)
    ├── database/                  (denied over HTTP)
    ├── public/                    (shared router, also usable as a docroot)
    └── storage/                   ← created on first upload, chmod 755
```

**The live app is NOT connected to this backend.** It keeps running on the cloud
backend until you decide to switch. This folder is the migration target and is
fully functional on its own.

## 1. Create the database (phpMyAdmin)

1. cPanel → MySQL® Databases → `neibasco_welfare data` / user `neibasco_Deno`
   with **ALL PRIVILEGES**.
2. phpMyAdmin → select the database → **Import** → `database/schema.sql`.
3. Import `database/seed.sql` (super admin + wallet rows).

## 2. Upload

1. Upload the React `dist/` contents to `public_html/`.
2. Copy `php-backend/deploy/root.htaccess` to `public_html/.htaccess`.
3. Upload the `php-backend` folder as `public_html/api`.
4. `chmod 755 public_html/api/storage` (create it if missing).
5. PHP 8.1+ selected in cPanel → MultiPHP Manager.

Credentials already set in `api/.env`:

```
DB_HOST=localhost
DB_NAME=neibasco_welfare data
DB_USER=neibasco_Deno
DB_PASSWORD=Deno@26###
```

Before going live change `JWT_SECRET` and fill the M-Pesa / Talksasa keys.

Health check: `GET https://welafarewebsit.neibasconsortium.co.ke/api/health`
→ `{"status":"ok","database":"connected"}`.

## 3. API surface (all under `/api`)

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/v1/token?grant_type=password` | Sign in with `{phone,password}` or `{email,password}` |
| `POST /api/auth/v1/token?grant_type=refresh_token` | Rotate the session |
| `POST /api/auth/v1/signup` | Create auth user + member profile |
| `GET /api/auth/v1/user` | Current user, roles and member profile |
| `POST /api/auth/v1/password` | Change own password |
| `POST /api/auth/v1/logout` | Revoke refresh tokens |
| `GET/POST/PATCH/DELETE /api/rest/v1/{table}` | CRUD, PostgREST-style filters |
| `POST /api/rest/v1/rpc/{fn}` | `has_role`, `get_member_login_activity`, `delete_member_safe`, `update_member_status`, `admin_reset_password`, `assign_user_role`, `increment`, `generate_memo_reference`, `get_members_with_roles` |
| `POST/GET/DELETE /api/storage/v1/object/{bucket}/{path}` | Files (`documents` private, others public) |

Filters: `?status=eq.active&order=created_at.desc&limit=50` plus
`neq, gt, gte, lt, lte, like, ilike, in, is, or`.
Auth header on every request: `Authorization: Bearer <access_token>`.

## 4. Security model

`src/Policy.php` is the row-level-security equivalent — each table declares which
roles may read/write and which column scopes rows to the signed-in member
(`member_id` / `user_id`). Unlisted tables are unreachable. Passwords are bcrypt,
sessions are HS256 JWTs with rotating refresh tokens. `src/`, `database/` and
`.env` are blocked at the web-server level.

`src/Hooks.php` reproduces the database triggers: UUID + timestamps, memo
reference numbers, wallet credit/debit on verified payments and completed
withdrawals, wallet-transaction running balances, and beneficiary-request
notifications.

## 5. Switching the frontend over (later, one file)

`frontend/client.ts` is a drop-in replacement for
`src/integrations/supabase/client.ts`. It exports the same `supabase` symbol and
supports the call shapes the app uses (`from().select().eq().order()`, `insert`,
`update`, `delete`, `rpc`, `auth.*`, `storage.from()`, `functions.invoke`,
`channel()` with polling instead of websockets).

To migrate:

1. Copy the MariaDB data across.
2. Copy `php-backend/frontend/client.ts` over `src/integrations/supabase/client.ts`.
3. Set `VITE_WMS_API_BASE=/api` (default already `/api`), rebuild, upload `dist`.

Until step 2 is done, the live app keeps talking to the cloud backend — nothing
in `src/` has been changed.
