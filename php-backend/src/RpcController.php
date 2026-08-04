<?php
declare(strict_types=1);

namespace App;

/** /rpc/{name} - PHP equivalents of the Postgres functions used by the app. */
final class RpcController
{
    public static function handle(string $name, array $body): void
    {
        switch ($name) {
            case 'has_role':
                $identity = Auth::require();
                $userId = (string) ($body['_user_id'] ?? $identity->userId);
                Response::json(in_array((string) ($body['_role'] ?? ''), Auth::rolesFor($userId), true));
                return;

            case 'get_members_with_roles':
                Auth::require();
                Response::json(Database::all(
                    'SELECT DISTINCT m.id, m.name, m.phone, m.is_active, m.user_id, m.created_at
                       FROM members m INNER JOIN user_roles ur ON ur.user_id = m.user_id
                      WHERE m.is_active = 1 ORDER BY m.name'
                ));
                return;

            case 'get_member_login_activity':
                self::loginActivity($body);
                return;

            case 'assign_user_role':
                Auth::requireRole('admin', 'super_admin');
                Database::run('DELETE FROM user_roles WHERE user_id = ? AND role = ?', [$body['user_id_param'], $body['role_param']]);
                Database::run('INSERT INTO user_roles (id, user_id, role, is_active) VALUES (?, ?, ?, 1)', [Uuid::v4(), $body['user_id_param'], $body['role_param']]);
                Response::json(['success' => true]);
                return;

            case 'update_member_status':
                Auth::requireRole('admin', 'super_admin');
                $status = (string) ($body['new_status'] ?? '');
                if (!in_array($status, ['active', 'suspended', 'deactivated'], true)) {
                    Response::json(['success' => false, 'error' => 'Invalid status']);
                    return;
                }
                $member = Database::one('SELECT id, name, user_id FROM members WHERE id = ?', [$body['target_member_id'] ?? '']);
                if ($member === null) {
                    Response::json(['success' => false, 'error' => 'Member not found']);
                    return;
                }
                Database::run('UPDATE members SET status = ?, is_active = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [$status, $status === 'active' ? 1 : 0, $member['id']]);
                if (!empty($member['user_id'])) {
                    Database::run('UPDATE auth_users SET is_banned = ? WHERE id = ?', [$status === 'active' ? 0 : 1, $member['user_id']]);
                }
                Response::json(['success' => true, 'member_name' => $member['name'], 'new_status' => $status]);
                return;

            case 'delete_member_safe':
                Auth::requireRole('admin', 'super_admin');
                $member = Database::one('SELECT id, name, user_id FROM members WHERE id = ?', [$body['target_member_id'] ?? '']);
                if ($member === null) {
                    Response::json(['success' => false, 'error' => 'Member not found']);
                    return;
                }
                Database::transaction(static function () use ($member) {
                    Database::run('DELETE FROM unmatched_payments WHERE payment_id IN (SELECT id FROM payments WHERE member_id = ?)', [$member['id']]);
                    Database::run('DELETE FROM members WHERE id = ?', [$member['id']]);
                    if (!empty($member['user_id'])) {
                        Database::run('DELETE FROM user_roles WHERE user_id = ?', [$member['user_id']]);
                        Database::run('DELETE FROM auth_users WHERE id = ?', [$member['user_id']]);
                    }
                });
                Response::json(['success' => true, 'deleted_member' => $member['name']]);
                return;

            case 'admin_reset_password':
                Auth::requireRole('super_admin');
                $password = (string) ($body['new_password'] ?? '');
                if (strlen($password) < 6) {
                    Response::json(['success' => false, 'error' => 'Password too short']);
                    return;
                }
                $rows = Database::run(
                    'UPDATE auth_users SET encrypted_password = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?',
                    [Auth::hashPassword($password), $body['target_user_id'] ?? '']
                );
                Response::json($rows > 0
                    ? ['success' => true, 'message' => 'Password reset successfully']
                    : ['success' => false, 'error' => 'User not found']);
                return;

            case 'generate_memo_reference':
                Auth::require();
                Response::json(Hooks::memoReference());
                return;

            case 'increment':
                Auth::requireRole('admin', 'super_admin', 'treasurer');
                $table = (string) ($body['table_name'] ?? '');
                $field = (string) ($body['field_name'] ?? '');
                if (!in_array($table, ['penalty_wallet', 'donation_wallet', 'operational_wallet'], true)
                    || !in_array($field, ['total_received', 'total_withdrawn', 'total_balance'], true)) {
                    throw new HttpException(400, 'invalid_request', 'Unsupported wallet or field');
                }
                $amount = (float) ($body['amount'] ?? 0);
                Database::run(sprintf('UPDATE `%s` SET `%s` = COALESCE(`%s`,0) + ? WHERE id = ?', $table, $field, $field), [$amount, $body['row_id'] ?? '']);
                if ($field === 'total_received') {
                    Database::run(sprintf('UPDATE `%s` SET total_balance = COALESCE(total_balance,0) + ? WHERE id = ?', $table), [$amount, $body['row_id'] ?? '']);
                } elseif ($field === 'total_withdrawn') {
                    Database::run(sprintf('UPDATE `%s` SET total_balance = COALESCE(total_balance,0) - ? WHERE id = ?', $table), [abs($amount), $body['row_id'] ?? '']);
                }
                Response::json(['success' => true]);
                return;

            default:
                throw new HttpException(404, 'unknown_function', sprintf('RPC "%s" is not defined', $name));
        }
    }

    private static function loginActivity(array $body): void
    {
        Auth::requireRole('super_admin');
        $search = trim((string) ($body['_search'] ?? ''));
        $limit = max(1, min((int) ($body['_limit'] ?? 50), 200));
        $offset = max(0, (int) ($body['_offset'] ?? 0));

        $where = '';
        $params = [];
        if ($search !== '') {
            $where = 'WHERE (m.name LIKE ? OR m.phone LIKE ?)';
            $params = ['%' . $search . '%', '%' . $search . '%'];
        }

        $total = (int) Database::value("SELECT COUNT(*) FROM members m $where", $params);
        $rows = Database::all(
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
        Response::json($rows);
    }
}
