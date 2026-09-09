<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Support\AuthService;
use App\Support\Casts;
use App\Support\Db;
use App\Support\Uuid;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** /auth/v1/* endpoints (sign in, sign up, refresh, current user, password) */
final class AuthController extends Controller
{
    public function token(Request $request): JsonResponse
    {
        $grant = (string) $request->query('grant_type', 'password');
        $body = $request->all();

        if ($grant === 'refresh_token') {
            return $this->refresh((string) ($body['refresh_token'] ?? ''));
        }

        $email = trim((string) ($body['email'] ?? ''));
        $phone = trim((string) ($body['phone'] ?? ''));
        $password = (string) ($body['password'] ?? '');

        if ($email === '' && $phone !== '') {
            $email = AuthService::emailForPhone($phone);
        }
        if ($email === '' || $password === '') {
            throw new ApiException(400, 'invalid_request', 'Phone/email and password are required');
        }

        $user = Db::one('SELECT * FROM auth_users WHERE email = ? LIMIT 1', [strtolower($email)]);
        if ($user === null || ! AuthService::verifyPassword($password, (string) $user['encrypted_password'])) {
            throw new ApiException(400, 'invalid_credentials', 'Invalid login credentials');
        }
        if ((int) $user['is_banned'] === 1) {
            throw new ApiException(403, 'user_banned', 'This account has been deactivated');
        }

        return response()->json(AuthService::issueSession($user));
    }

    private function refresh(string $token): JsonResponse
    {
        if ($token === '') {
            throw new ApiException(400, 'invalid_request', 'refresh_token is required');
        }

        $row = Db::one(
            'SELECT * FROM auth_refresh_tokens WHERE token = ? AND revoked = 0 AND expires_at > UTC_TIMESTAMP(3) LIMIT 1',
            [$token]
        );
        if ($row === null) {
            throw new ApiException(401, 'invalid_grant', 'Refresh token is invalid or expired');
        }

        Db::run('UPDATE auth_refresh_tokens SET revoked = 1 WHERE id = ?', [$row['id']]);

        $user = Db::one('SELECT * FROM auth_users WHERE id = ?', [$row['user_id']]);
        if ($user === null) {
            throw new ApiException(401, 'invalid_grant', 'Account no longer exists');
        }

        return response()->json(AuthService::issueSession($user));
    }

    /** Creates an auth user + member profile. Admin only unless self-registration is enabled. */
    public function signup(Request $request): JsonResponse
    {
        $body = $request->all();
        $identity = AuthService::identity();

        $config = Db::one('SELECT active FROM registration_config LIMIT 1');
        $openRegistration = $config !== null && (int) $config['active'] === 1;
        if (! $identity->isAdmin() && ! $openRegistration) {
            throw new ApiException(403, 'forbidden', 'Self registration is currently closed');
        }

        $name = trim((string) ($body['name'] ?? ''));
        $phone = trim((string) ($body['phone'] ?? ''));
        if ($name === '' || $phone === '') {
            throw new ApiException(400, 'invalid_request', 'name and phone are required');
        }

        $phone = AuthService::normalizePhone($phone);
        $email = (string) ($body['email'] ?? AuthService::emailForPhone($phone));
        $password = (string) ($body['password'] ?? config('welfare.default_member_password'));

        if (Db::one('SELECT id FROM auth_users WHERE email = ?', [strtolower($email)]) !== null) {
            throw new ApiException(409, 'user_exists', 'An account with this phone number already exists');
        }

        $created = Db::transaction(static function () use ($name, $phone, $email, $password, $body) {
            $userId = Uuid::v4();
            Db::run(
                'INSERT INTO auth_users (id, email, phone, encrypted_password, raw_user_meta_data) VALUES (?, ?, ?, ?, ?)',
                [$userId, strtolower($email), $phone, AuthService::hashPassword($password), json_encode(['name' => $name])]
            );
            Db::run(
                'INSERT INTO user_roles (id, user_id, role, is_active) VALUES (?, ?, ?, 1)',
                [Uuid::v4(), $userId, 'member']
            );
            $memberId = Uuid::v4();
            Db::run(
                'INSERT INTO members (id, user_id, name, phone, member_id, is_active, status) VALUES (?, ?, ?, ?, ?, 1, ?)',
                [$memberId, $userId, $name, $phone, $body['member_id'] ?? null, 'active']
            );

            return ['user_id' => $userId, 'member_id' => $memberId];
        });

        return response()->json([
            'user' => ['id' => $created['user_id'], 'email' => strtolower($email)],
            'member' => ['id' => $created['member_id'], 'name' => $name, 'phone' => $phone],
            'login' => ['phone' => $phone, 'password' => $password],
        ], 201);
    }

    public function user(): JsonResponse
    {
        $identity = AuthService::require();
        $member = Db::one('SELECT * FROM members WHERE user_id = ? LIMIT 1', [$identity->userId]);

        return response()->json([
            'id' => $identity->userId,
            'email' => $identity->email,
            'roles' => $identity->roles,
            'member' => $member === null ? null : Casts::out('members', $member),
        ]);
    }

    public function logout(): JsonResponse
    {
        $identity = AuthService::require();
        Db::run('UPDATE auth_refresh_tokens SET revoked = 1 WHERE user_id = ?', [$identity->userId]);

        return response()->json(null, 204);
    }

    /** Any signed-in user changes their own password. */
    public function changePassword(Request $request): JsonResponse
    {
        $identity = AuthService::require();
        $current = (string) $request->input('current_password', '');
        $next = (string) $request->input('new_password', '');

        if (strlen($next) < 6) {
            throw new ApiException(400, 'weak_password', 'New password must be at least 6 characters');
        }

        $user = Db::one('SELECT encrypted_password FROM auth_users WHERE id = ?', [$identity->userId]);
        if ($user === null || ! AuthService::verifyPassword($current, (string) $user['encrypted_password'])) {
            throw new ApiException(400, 'invalid_credentials', 'Current password is incorrect');
        }

        Db::run(
            'UPDATE auth_users SET encrypted_password = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?',
            [AuthService::hashPassword($next), $identity->userId]
        );

        return response()->json(['success' => true]);
    }
}
