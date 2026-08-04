<?php
declare(strict_types=1);

namespace App;

/** Authenticated identity resolved from the bearer token. */
final class Identity
{
    public function __construct(
        public readonly ?string $userId = null,
        public readonly ?string $email = null,
        /** @var array<int,string> */
        public readonly array $roles = [],
        public readonly ?string $memberId = null
    ) {
    }

    public function isAuthenticated(): bool
    {
        return $this->userId !== null;
    }

    public function hasRole(string ...$roles): bool
    {
        foreach ($roles as $role) {
            if (in_array($role, $this->roles, true)) {
                return true;
            }
        }
        return false;
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole('super_admin');
    }

    public function isAdmin(): bool
    {
        return $this->hasRole('admin', 'super_admin');
    }

    public function isStaff(): bool
    {
        return $this->hasRole(
            'admin',
            'super_admin',
            'treasurer',
            'chairperson',
            'vice_chairperson',
            'secretary',
            'vice_secretary',
            'patron'
        );
    }
}

final class Auth
{
    private static ?Identity $identity = null;

    public static function identity(): Identity
    {
        if (self::$identity instanceof Identity) {
            return self::$identity;
        }

        $token = self::bearerToken();
        if ($token === null) {
            return self::$identity = new Identity();
        }

        $payload = Jwt::decode($token);
        $userId = (string) ($payload['sub'] ?? '');
        if ($userId === '') {
            return self::$identity = new Identity();
        }

        $user = Database::one('SELECT id, email, is_banned FROM auth_users WHERE id = ?', [$userId]);
        if ($user === null) {
            throw new HttpException(401, 'user_not_found', 'Account no longer exists');
        }
        if ((int) $user['is_banned'] === 1) {
            throw new HttpException(403, 'user_banned', 'This account has been deactivated');
        }

        return self::$identity = new Identity(
            $userId,
            (string) $user['email'],
            self::rolesFor($userId),
            self::memberIdFor($userId)
        );
    }

    public static function require(): Identity
    {
        $identity = self::identity();
        if (!$identity->isAuthenticated()) {
            throw new HttpException(401, 'unauthorized', 'Authentication required');
        }
        return $identity;
    }

    public static function requireRole(string ...$roles): Identity
    {
        $identity = self::require();
        if (!$identity->hasRole(...$roles)) {
            throw new HttpException(403, 'forbidden', 'You do not have permission to perform this action');
        }
        return $identity;
    }

    /** @return array<int,string> */
    public static function rolesFor(string $userId): array
    {
        $rows = Database::all(
            'SELECT role FROM user_roles WHERE user_id = ? AND (is_active IS NULL OR is_active = 1)',
            [$userId]
        );
        $roles = array_map(static fn ($r) => (string) $r['role'], $rows);
        if ($roles === []) {
            $roles = ['member'];
        }
        // super_admin implies admin privileges throughout the app
        if (in_array('super_admin', $roles, true) && !in_array('admin', $roles, true)) {
            $roles[] = 'admin';
        }
        return array_values(array_unique($roles));
    }

    public static function memberIdFor(string $userId): ?string
    {
        $row = Database::one('SELECT id FROM members WHERE user_id = ? LIMIT 1', [$userId]);
        return $row['id'] ?? null;
    }

    public static function bearerToken(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? '';
        if ($header === '' && function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            foreach ($headers as $key => $value) {
                if (strtolower($key) === 'authorization') {
                    $header = $value;
                    break;
                }
            }
        }
        if ($header === '' || stripos($header, 'bearer ') !== 0) {
            return null;
        }
        $token = trim(substr($header, 7));
        return $token === '' ? null : $token;
    }

    public static function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT);
    }

    public static function verifyPassword(string $password, string $hash): bool
    {
        return password_verify($password, $hash);
    }

    /** Normalises 07..., 7..., 254..., +254... into +2547XXXXXXXX */
    public static function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (str_starts_with($digits, '254')) {
            return '+' . $digits;
        }
        if (str_starts_with($digits, '0')) {
            return '+254' . substr($digits, 1);
        }
        if (strlen($digits) === 9) {
            return '+254' . $digits;
        }
        return '+' . $digits;
    }

    /** Members sign in with their phone number; it maps to a synthetic email. */
    public static function emailForPhone(string $phone): string
    {
        return str_replace('+', '', self::normalizePhone($phone)) . '@welfare.local';
    }

    public static function issueSession(array $user): array
    {
        $userId = (string) $user['id'];
        $roles = self::rolesFor($userId);
        $accessToken = Jwt::encode([
            'sub' => $userId,
            'email' => $user['email'],
            'roles' => $roles,
        ]);

        $refresh = bin2hex(random_bytes(32));
        Database::run(
            'INSERT INTO auth_refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
            [Uuid::v4(), $userId, $refresh, gmdate('Y-m-d H:i:s', time() + Env::int('REFRESH_TTL', 2592000))]
        );

        Database::run('UPDATE auth_users SET last_sign_in_at = UTC_TIMESTAMP(3) WHERE id = ?', [$userId]);

        $member = Database::one('SELECT id, name, phone, status, is_active FROM members WHERE user_id = ? LIMIT 1', [$userId]);

        return [
            'access_token' => $accessToken,
            'token_type' => 'bearer',
            'expires_in' => Env::int('JWT_TTL', 3600),
            'refresh_token' => $refresh,
            'user' => [
                'id' => $userId,
                'email' => $user['email'],
                'roles' => $roles,
                'member' => $member,
            ],
        ];
    }
}
