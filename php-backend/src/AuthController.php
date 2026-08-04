<?php
declare(strict_types=1);

namespace App;

/** /auth/v1/* endpoints (sign in, sign up, refresh, current user, password admin) */
final class AuthController
{
    public static function token(array $body, array $query): void
    {
        $grant = $query['grant_type'] ?? 'password';

        if ($grant === 'refresh_token') {
            self::refresh((string) ($body['refresh_token'] ?? ''));
            return;
        }

        $email = trim((string) ($body['email'] ?? ''));
        $phone = trim((string) ($body['phone'] ?? ''));
        $password = (string) ($body['password'] ?? '');

        if ($email === '' && $phone !== '') {
            $email = Auth::emailForPhone($phone);
        }
        if ($email === '' || $password === '') {
            throw new HttpException(400, 'invalid_request', 'Phone/email and password are required');
        }

        $user = Database::one('SELECT * FROM auth_users WHERE email = ? LIMIT 1', [strtolower($email)]);
        if ($user === null || !Auth::verifyPassword($password, (string) $user['encrypted_password'])) {
            throw new HttpException(400, 'invalid_credentials', 'Invalid login credentials');
        }
        if ((int) $user['is_banned'] === 1) {
            throw new HttpException(403, 'user_banned', 'This account has been deactivated');
        }

        Response::json(Auth::issueSession($user));
    }

    private static function refresh(string $token): void
    {
        if ($token === '') {
            throw new HttpException(400, 'invalid_request', 'refresh_token is required');
        }
        $row = Database::one(
            'SELECT * FROM auth_refresh_tokens WHERE token = ? AND revoked = 0 AND expires_at > UTC_TIMESTAMP(3) LIMIT 1',
            [$token]
        );
        if ($row === null) {
            throw new HttpException(401, 'invalid_grant', 'Refresh token is invalid or expired');
        }
        Database::run('UPDATE auth_refresh_tokens SET revoked = 1 WHERE id = ?', [$row['id']]);
        $user = Database::one('SELECT * FROM auth_users WHERE id = ?', [$row['user_id']]);
        if ($user === null) {
            throw new HttpException(401, 'invalid_grant', 'Account no longer exists');
        }
        Response::json(Auth::issueSession($user));
    }

    /** Creates an auth user + member profile. Admin only unless self-registration is enabled. */
    public static function signup(array $body): void
    {
        $identity = Auth::identity();
        $config = Database::one('SELECT active FROM registration_config LIMIT 1');
        $openRegistration = $config !== null && (int) $config['active'] === 1;
        if (!$identity->isAdmin() && !$openRegistration) {
            throw new HttpException(403, 'forbidden', 'Self registration is currently closed');
        }

        $name = trim((string) ($body['name'] ?? ''));
        $phone = trim((string) ($body['phone'] ?? ''));
        if ($name === '' || $phone === '') {
            throw new HttpException(400, 'invalid_request', 'name and phone are required');
        }
        $phone = Auth::normalizePhone($phone);
        $email = $body['email'] ?? Auth::emailForPhone($phone);
        $password = (string) ($body['password'] ?? Env::get('DEFAULT_MEMBER_PASSWORD', 'Member2026'));

        if (Database::one('SELECT id FROM auth_users WHERE email = ?', [strtolower($email)]) !== null) {
            throw new HttpException(409, 'user_exists', 'An account with this phone number already exists');
        }

        $created = Database::transaction(static function () use ($name, $phone, $email, $password, $body) {
            $userId = Uuid::v4();
            Database::run(
                'INSERT INTO auth_users (id, email, phone, encrypted_password, raw_user_meta_data) VALUES (?, ?, ?, ?, ?)',
                [$userId, strtolower($email), $phone, Auth::hashPassword($password), json_encode(['name' => $name])]
            );
            Database::run(
                'INSERT INTO user_roles (id, user_id, role, is_active) VALUES (?, ?, ?, 1)',
                [Uuid::v4(), $userId, 'member']
            );
            $memberId = Uuid::v4();
            Database::run(
                'INSERT INTO members (id, user_id, name, phone, member_id, is_active, status) VALUES (?, ?, ?, ?, ?, 1, ?)',
                [$memberId, $userId, $name, $phone, $body['member_id'] ?? null, 'active']
            );
            return ['user_id' => $userId, 'member_id' => $memberId];
        });

        Response::json([
            'user' => ['id' => $created['user_id'], 'email' => strtolower($email)],
            'member' => ['id' => $created['member_id'], 'name' => $name, 'phone' => $phone],
            'login' => ['phone' => $phone, 'password' => $password],
        ], 201);
    }

    public static function user(): void
    {
        $identity = Auth::require();
        $member = Database::one('SELECT * FROM members WHERE user_id = ? LIMIT 1', [$identity->userId]);
        Response::json([
            'id' => $identity->userId,
            'email' => $identity->email,
            'roles' => $identity->roles,
            'member' => $member === null ? null : Casts::out('members', $member),
        ]);
    }

    public static function logout(): void
    {
        $identity = Auth::require();
        Database::run('UPDATE auth_refresh_tokens SET revoked = 1 WHERE user_id = ?', [$identity->userId]);
        Response::noContent();
    }

    /** Any signed-in user changes their own password. */
    public static function changePassword(array $body): void
    {
        $identity = Auth::require();
        $current = (string) ($body['current_password'] ?? '');
        $next = (string) ($body['new_password'] ?? '');
        if (strlen($next) < 6) {
            throw new HttpException(400, 'weak_password', 'New password must be at least 6 characters');
        }
        $user = Database::one('SELECT encrypted_password FROM auth_users WHERE id = ?', [$identity->userId]);
        if ($user === null || !Auth::verifyPassword($current, (string) $user['encrypted_password'])) {
            throw new HttpException(400, 'invalid_credentials', 'Current password is incorrect');
        }
        Database::run(
            'UPDATE auth_users SET encrypted_password = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?',
            [Auth::hashPassword($next), $identity->userId]
        );
        Response::json(['success' => true]);
    }
}
