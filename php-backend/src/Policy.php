<?php
declare(strict_types=1);

namespace App;

/**
 * Row level security equivalent.
 *
 * Every table declares who may read/write it and, for member facing tables,
 * which column scopes a row to the signed-in member. Anything not listed here
 * is admin/super-admin only, so new tables are locked down by default.
 */
final class Policy
{
    private const STAFF = ['admin', 'super_admin', 'treasurer', 'chairperson', 'vice_chairperson', 'secretary', 'vice_secretary', 'patron'];

    /**
     * read  : roles allowed to read every row ('*' = any signed-in user)
     * write : roles allowed to insert/update/delete every row
     * own   : column used to scope rows to the signed-in user
     *         'member_id' -> compared with the caller's members.id
     *         'user_id'   -> compared with the caller's auth user id
     * ownWrite : member may insert/update their own rows
     */
    private const TABLES = [
        // --- core member data ---
        'members' => ['read' => ['*'], 'write' => ['admin', 'super_admin'], 'own' => 'user_id', 'ownWrite' => true],
        'user_roles' => ['read' => ['*'], 'write' => ['admin', 'super_admin']],
        'beneficiaries' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin'], 'own' => 'member_id', 'ownWrite' => true],
        'beneficiary_requests' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin'], 'own' => 'member_id', 'ownWrite' => true],
        'documents' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin'], 'own' => 'member_id', 'ownWrite' => true],
        'contributions' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer'], 'own' => 'member_id'],
        'penalties' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer'], 'own' => 'member_id'],
        'penalty_payments' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer'], 'own' => 'member_id', 'ownWrite' => true],
        'penalty_payment_records' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer'], 'own' => 'member_id', 'ownWrite' => true],
        'donation_payment_records' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer'], 'own' => 'member_id', 'ownWrite' => true],
        'operational_payment_records' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer'], 'own' => 'member_id', 'ownWrite' => true],
        'payments' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer'], 'own' => 'member_id'],
        'payouts' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer'], 'own' => 'member_id'],
        'bank_transactions' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer'], 'own' => 'member_id'],

        // --- content everyone can read ---
        'news' => ['read' => ['*'], 'write' => ['admin', 'super_admin', 'secretary', 'vice_secretary']],
        'events' => ['read' => ['*'], 'write' => ['admin', 'super_admin', 'secretary', 'vice_secretary']],
        'donation_campaigns' => ['read' => ['*'], 'write' => ['admin', 'super_admin', 'treasurer']],
        'executive_badges' => ['read' => ['*'], 'write' => ['admin', 'super_admin']],
        'office_bearer_signatures' => ['read' => ['*'], 'write' => ['admin', 'super_admin']],
        'organization_settings' => ['read' => ['*'], 'write' => ['admin', 'super_admin']],
        'welfare_settings' => ['read' => ['*'], 'write' => ['admin', 'super_admin']],
        'registration_config' => ['read' => ['*'], 'write' => ['admin', 'super_admin']],
        'memo_templates' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'secretary', 'treasurer']],

        // --- per user rows ---
        'notifications' => ['read' => ['admin', 'super_admin'], 'write' => ['admin', 'super_admin'], 'own' => 'user_id', 'ownWrite' => true],
        'news_read' => ['read' => ['*'], 'write' => ['admin', 'super_admin'], 'own' => 'user_id', 'ownWrite' => true],
        'push_tokens' => ['read' => ['admin', 'super_admin'], 'write' => ['admin', 'super_admin'], 'own' => 'user_id', 'ownWrite' => true],
        'user_presence' => ['read' => ['*'], 'write' => ['admin', 'super_admin'], 'own' => 'user_id', 'ownWrite' => true],
        'dashboard_security' => ['read' => [], 'write' => [], 'own' => 'user_id', 'ownWrite' => true],
        'signatory_signatures' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin'], 'own' => 'user_id', 'ownWrite' => true],

        // --- chat ---
        'conversations' => ['read' => ['*'], 'write' => ['*']],
        'conversation_participants' => ['read' => ['*'], 'write' => ['*']],
        'messages' => ['read' => ['*'], 'write' => ['*']],
        'message_reactions' => ['read' => ['*'], 'write' => ['*']],

        // --- memos & minutes ---
        'memos' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'secretary', 'vice_secretary', 'treasurer', 'chairperson']],
        'memo_recipients' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'secretary', 'vice_secretary', 'treasurer', 'chairperson'], 'own' => 'member_id', 'ownWrite' => true],
        'meeting_minutes' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'secretary', 'vice_secretary', 'chairperson']],
        'meeting_attendance' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'secretary', 'vice_secretary']],
        'action_items' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'secretary', 'vice_secretary']],

        // --- treasury ---
        'penalty_wallet' => ['read' => ['*'], 'write' => ['admin', 'super_admin', 'treasurer']],
        'donation_wallet' => ['read' => ['*'], 'write' => ['admin', 'super_admin', 'treasurer']],
        'operational_wallet' => ['read' => ['*'], 'write' => ['admin', 'super_admin', 'treasurer']],
        'wallet_transactions' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer']],
        'book_balance' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer']],
        'expenses' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer']],
        'financial_reports' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer']],
        'penalty_withdrawals' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer']],
        'donation_withdrawals' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer']],
        'operational_withdrawals' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer']],
        'withdrawal_signatories' => ['read' => self::STAFF, 'write' => self::STAFF],
        'donation_withdrawal_signatories' => ['read' => self::STAFF, 'write' => self::STAFF],
        'operational_withdrawal_signatories' => ['read' => self::STAFF, 'write' => self::STAFF],
        'withdrawal_receipts' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer']],
        'b2c_transactions' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer']],
        'unmatched_payments' => ['read' => self::STAFF, 'write' => ['admin', 'super_admin', 'treasurer']],

        // --- registration ---
        'member_registrations' => ['read' => ['admin', 'super_admin'], 'write' => ['admin', 'super_admin'], 'publicInsert' => true],
        'registration_fees' => ['read' => ['admin', 'super_admin'], 'write' => ['admin', 'super_admin'], 'publicInsert' => true],
        'registration_access_links' => ['read' => ['admin', 'super_admin'], 'write' => ['admin', 'super_admin']],

        // --- audit / ops (super admin) ---
        'audit_logs' => ['read' => ['super_admin'], 'write' => ['super_admin', 'admin']],
        'member_access_logs' => ['read' => ['super_admin'], 'write' => ['super_admin', 'admin']],
        'system_logs' => ['read' => ['super_admin'], 'write' => ['super_admin', 'admin']],
        'system_health' => ['read' => ['super_admin'], 'write' => ['super_admin']],
        'sms_logs' => ['read' => ['admin', 'super_admin'], 'write' => ['admin', 'super_admin']],
        'password_resets' => ['read' => ['super_admin'], 'write' => ['super_admin']],
    ];

    public static function isKnownTable(string $table): bool
    {
        return isset(self::TABLES[$table]);
    }

    /** @return array<string,mixed> */
    public static function rules(string $table): array
    {
        if (!isset(self::TABLES[$table])) {
            throw new HttpException(404, 'unknown_table', sprintf('Table "%s" is not exposed by the API', $table));
        }
        return self::TABLES[$table];
    }

    public static function canReadAll(string $table, Identity $identity): bool
    {
        $rules = self::rules($table);
        $read = $rules['read'] ?? [];
        if (in_array('*', $read, true)) {
            return $identity->isAuthenticated();
        }
        return $identity->hasRole(...$read);
    }

    public static function canWriteAll(string $table, Identity $identity): bool
    {
        $rules = self::rules($table);
        $write = $rules['write'] ?? [];
        if (in_array('*', $write, true)) {
            return $identity->isAuthenticated();
        }
        return $identity->hasRole(...$write);
    }

    /**
     * Returns [sqlFragment, params] restricting a SELECT to rows the caller owns,
     * or null when the caller may read everything.
     */
    public static function readScope(string $table, Identity $identity): ?array
    {
        if (self::canReadAll($table, $identity)) {
            return null;
        }
        $rules = self::rules($table);
        $own = $rules['own'] ?? null;
        if ($own === null) {
            throw new HttpException(403, 'forbidden', sprintf('You are not allowed to read "%s"', $table));
        }
        if ($own === 'user_id') {
            return ['`user_id` = ?', [$identity->userId]];
        }
        if ($identity->memberId === null) {
            throw new HttpException(403, 'forbidden', 'No member profile is linked to this account');
        }
        return ['`member_id` = ?', [$identity->memberId]];
    }

    /** Throws unless the caller may write this row. */
    public static function assertWrite(string $table, array $row, Identity $identity, string $action): void
    {
        if (self::canWriteAll($table, $identity)) {
            return;
        }
        $rules = self::rules($table);
        if (($rules['ownWrite'] ?? false) !== true) {
            throw new HttpException(403, 'forbidden', sprintf('You are not allowed to %s "%s"', $action, $table));
        }
        $own = $rules['own'] ?? null;
        if ($own === 'user_id') {
            if (($row['user_id'] ?? null) !== $identity->userId) {
                throw new HttpException(403, 'forbidden', 'You can only modify your own records');
            }
            return;
        }
        if ($own === 'member_id') {
            if ($identity->memberId === null || ($row['member_id'] ?? null) !== $identity->memberId) {
                throw new HttpException(403, 'forbidden', 'You can only modify your own records');
            }
            return;
        }
        throw new HttpException(403, 'forbidden', sprintf('You are not allowed to %s "%s"', $action, $table));
    }

    public static function allowsPublicInsert(string $table): bool
    {
        return (self::rules($table)['publicInsert'] ?? false) === true;
    }
}
