# KHCWW Welfare API (Laravel 12 + MariaDB)

Self-contained backend for **welafarewebsit.neibasconsortium.co.ke**, deployed in the
same cPanel folder as the React frontend. No subdomain, no CORS.

```
public_html/
├── index.html, assets/ ...   ← React build
├── .htaccess                 ← SPA fallback + /api rewrite
└── api/                      ← this Laravel app
    ├── public/index.php      ← front controller
    ├── app/ bootstrap/ config/ database/ routes/ storage/ vendor/
    └── .env                  ← database + secrets
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | service + database status |
| POST | `/api/auth/v1/token?grant_type=password` | sign in with phone/email + password |
| POST | `/api/auth/v1/token?grant_type=refresh_token` | refresh a session |
| POST | `/api/auth/v1/signup` | create an account |
| GET | `/api/auth/v1/user` | current user + roles |
| POST | `/api/auth/v1/password` | change own password |
| POST | `/api/auth/v1/logout` | revoke refresh tokens |
| GET/POST/PATCH/DELETE | `/api/rest/v1/{table}` | CRUD with PostgREST-style filters |
| POST | `/api/rest/v1/rpc/{name}` | `has_role`, `get_members_with_roles`, `get_member_login_activity`, `assign_user_role`, `update_member_status`, `delete_member_safe`, `admin_reset_password`, `generate_memo_reference`, `increment` |
| POST/GET/DELETE | `/api/storage/v1/object/{bucket}/{path}` | file storage (`documents` private; `profile-images`, `signatures`, `chat-attachments` public) |

Filters supported on reads: `select`, `eq/neq/gt/gte/lt/lte`, `like/ilike`, `in`, `is`,
`not`, `or`, `order`, `limit`, `offset`, `count=exact`.

## Deploy to cPanel

1. Create the MariaDB database and user in cPanel, then import
   `api/database/sql/schema.sql` followed by `api/database/sql/seed.sql` in phpMyAdmin.
2. Upload the bundle so the frontend lands in `public_html/` and this app in `public_html/api/`.
3. Edit `public_html/api/.env`: `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, and a long random `JWT_SECRET`.
4. Set PHP 8.2+ for the domain (extensions: pdo_mysql, mbstring, openssl, fileinfo).
5. Make `api/storage` and `api/bootstrap/cache` writable (755).
6. Visit `https://your-domain/api/health` — it must report `"database":"connected"`.
7. Sign in with `0700000000` / `Member2026` (seeded super admin) and change the password.

`APP_KEY` is already generated in the shipped `.env`; regenerate with
`php artisan key:generate` if you prefer your own.

## Switching the frontend over

The React app still talks to the cloud backend. When you are ready to move,
copy `frontend/client.ts` over `src/integrations/supabase/client.ts` and rebuild —
it exposes the same `supabase` object and call shapes, pointed at same-origin `/api`.

## Local verification

`bash tests/local-stack.sh` boots a throwaway MariaDB, migrates, seeds, serves the API
and runs `tests/e2e.sh` (27 endpoint checks covering auth, CRUD, RPC, storage, CORS).
