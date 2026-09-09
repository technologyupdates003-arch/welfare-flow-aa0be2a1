<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Support\AuthService;
use App\Support\Db;
use App\Support\Hooks;
use App\Support\Uuid;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** /rest/v1/rpc/{name} - PHP equivalents of the Postgres functions used by the app. */
final class RpcController extends Controller
{
    public function handle(Request $request, string $name): JsonResponse
    {
        $body = $request->all();

        return match ($name) {
            'has_role' => $this->hasRole($body),
            'get_members_with_roles' => $this->membersWithRoles(),
            'get_member_login_activity' => $this->loginActivity($body),
            'assign_user_role' => $this->assignUserRole($body),
            'update_member_status' => $this->updateMemberStatus($body),
            'delete_member_safe' => $this->deleteMemberSafe($body),
            'admin_reset_password' => $this->adminResetPassword($body),
            'generate_memo_reference' => $this->memoReference(),
            'increment' => $this->increment($body),
            default => throw new ApiException(404, 'unknown_function', sprintf('RPC "%s" is not defined', $name)),
        };
    }

    private function hasRole(array $body): JsonResponse
    {
        $identity = AuthService::require();
        $userId = (string) ($body['_user_id'] ?? $identity->userId);

        return response()->json(in_array((string) ($body['_role'] ?? ''), AuthService::rolesFor($userId), true));
    }

    private function membersWithRoles(): JsonResponse
    {
        AuthService::require();

        return response()->json(Db::all(
            'SELECT DISTINCT m.id, m.name, m.phone, m.is_active, m.user_id, m.created_at
               FROM members m INNER JOIN user_roles ur ON ur.user_id = m.user_id
              WHERE m.is_active = 1 ORDER BY m.name'
        ));
    }

    private function assignUserRole(array $body): JsonResponse
    {
        AuthService::requireRole('admin', 'super_admin');
        Db::run('DELETE FROM user_roles WHERE user_id = ? AND role = ?', [$body['user_id_param'] ?? '', $body['role_param'] ?? '']);
        Db::run(
            'INSERT INTO user_roles (id, user_id, role, is_active) VALUES (?, ?, ?, 1)',
            [Uuid::v4(), $body['user_id_param'] ?? '', $body['role_param'] ?? '']
        );

        return response()->json(['success' => true]);
    }

    private function updateMemberStatus(array $body): JsonResponse
    {
        AuthService::requireRole('admin', 'super_admin');
        $status = (string) ($body['new_status'] ?? '');
        if (! in_array($status, ['active', 'suspended', 'deactivated'], true)) {
            return response()->json(['success' => false, 'error' => 'Invalid status']);
        }

        $member = Db::one('SELECT id, name, user_id FROM members WHERE id = ?', [$body['target_member_id'] ?? '']);
        if ($member === null) {
            return response()->json(['success' => false, 'error' => 'Member not found']);
        }

        Db::run(
            'UPDATE members SET status = ?, is_active = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?',
            [$status, $status === 'active' ? 1 : 0, $member['id']]
        );
        if (! empty($member['user_id'])) {
            Db::run('UPDATE auth_users SET is_banned = ? WHERE id = ?', [$status === 'active' ? 0 : 1, $member['user_id']]);
        }

        return response()->json(['success' => true, 'member_name' => $member['name'], 'new_status' => $status]);
    }

    private function deleteMemberSafe(array $body): JsonResponse
    {
        AuthService::requireRole('admin', 'super_admin');
        $member = Db::one('SELECT id, name, user_id FROM members WHERE id = ?', [$body['target_member_id'] ?? '']);
        if ($member === null) {
            return response()->json(['success' => false, 'error' => 'Member not found']);
        }

        Db::transaction(static function () use ($member) {
            Db::run('DELETE FROM unmatched_payments WHERE payment_id IN (SELECT id FROM payments WHERE member_id = ?)', [$member['id']]);
            Db::run('DELETE FROM members WHERE id = ?', [$member['id']]);
            if (! empty($member['user_id'])) {
                Db::run('DELETE FROM user_roles WHERE user_id = ?', [$member['user_id']]);
                Db::run('DELETE FROM auth_users WHERE id = ?', [$member['user_id']]);
            }
        });

        return response()->json(['success' => true, 'deleted_member' => $member['name']]);
    }

    private function adminResetPassword(array $body): JsonResponse
    {
        AuthService::requireRole('super_admin');
        $password = (string) ($body['new_password'] ?? '');
        if (strlen($password) < 6) {
            return response()->json(['success' => false, 'error' => 'Password too short']);
        }

        $rows = Db::run(
            'UPDATE auth_users SET encrypted_password = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?',
            [AuthService::hashPassword($password), $body['target_user_id'] ?? '']
        );

        return response()->json($rows > 0
            ? ['success' => true, 'message' => 'Password reset successfully']
            : ['success' => false, 'error' => 'User not found']);
    }

    private function memoReference(): JsonResponse
    {
        AuthService::require();

        return response()->json(Hooks::memoReference());
    }

    private function increment(array $body): JsonResponse
    {
        AuthService::requireRole('admin', 'super_admin', 'treasurer');
        $table = (string) ($body['table_name'] ?? '');
        $field = (string) ($body['field_name'] ?? '');

        if (! in_array($table, ['penalty_wallet', 'donation_wallet', 'operational_wallet'], true)
            || ! in_array($field, ['total_received', 'total_withdrawn', 'total_balance'], true)) {
            throw new ApiException(400, 'invalid_request', 'Unsupported wallet or field');
        }

        $amount = (float) ($body['amount'] ?? 0);
        Db::run(sprintf('UPDATE `%s` SET `%s` = COALESCE(`%s`,0) + ? WHERE id = ?', $table, $field, $field), [$amount, $body['row_id'] ?? '']);

        if ($field === 'total_received') {
            Db::run(sprintf('UPDATE `%s` SET total_balance = COALESCE(total_balance,0) + ? WHERE id = ?', $table), [$amount, $body['row_id'] ?? '']);
        } elseif ($field === 'total_withdrawn') {
            Db::run(sprintf('UPDATE `%s` SET total_balance = COALESCE(total_balance,0) - ? WHERE id = ?', $table), [abs($amount), $body['row_id'] ?? '']);
        }

        return response()->json(['success' => true]);
    }

    private function loginActivity(array $body): JsonResponse
    {
        AuthService::requireRole('super_admin');
        $search = trim((string) ($body['_search'] ?? ''));
        $limit = max(1, min((int) ($body['_limit'] ?? 50), 200));
        $offset = max(0, (int) ($body['_offset'] ?? 0));

        $where = '';
        $params = [];
        if ($search !== '') {
            $where = 'WHERE (m.name LIKE ? OR m.phone LIKE ?)';
            $params = ['%'.$search.'%', '%'.$search.'%'];
        }

        $total = (int) Db::value("SELECT COUNT(*) FROM members m $where", $params);
        $rows = Db::all(
            "SELECT m.id AS member_id, m.user_id, m.name, m.phone, u.email, m.is_active,
                    u.last_sign_in_at, u.created_at
               FROM members m LEFT JOIN auth_users u ON u.id = m.user_id
               $where
              ORDER BY u.last_sign_in_at IS NULL, u.last_sign_in_at DESC, m.name ASC
              LIMIT $limit OFFSET $offset",
            $params
        );

        foreach ($rows as &$row) {
            $row['total_count'] = $total;
            $row['is_active'] = (bool) $row['is_active'];
        }

        return response()->json($rows);
    }
}
