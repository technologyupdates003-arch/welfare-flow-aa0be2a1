<?php
declare(strict_types=1);

namespace App;

/** PHP equivalents of the Postgres triggers used by the app. */
final class Hooks
{
    public static function beforeInsert(string $table, array $row, Identity $identity): array
    {
        $columns = Database::columns($table);
        if (in_array('id', $columns, true) && empty($row['id'])) {
            $row['id'] = Uuid::v4();
        }
        $now = gmdate('Y-m-d H:i:s.v');
        foreach (['created_at', 'updated_at'] as $col) {
            if (in_array($col, $columns, true) && empty($row[$col])) {
                $row[$col] = $now;
            }
        }
        if ($table === 'memos' && empty($row['reference_number'])) {
            $row['reference_number'] = self::memoReference();
        }
        if ($table === 'wallet_transactions') {
            $row = self::walletTransaction($row);
        }
        return $row;
    }

    public static function beforeUpdate(string $table, array $changes): array
    {
        if (in_array('updated_at', Database::columns($table), true)) {
            $changes['updated_at'] = gmdate('Y-m-d H:i:s.v');
        }
        if ($table === 'b2c_transactions' && ($changes['status'] ?? null) === 'completed' && empty($changes['completed_at'])) {
            $changes['completed_at'] = gmdate('Y-m-d H:i:s.v');
        }
        return $changes;
    }

    public static function afterWrite(string $table, array $row, ?array $previous, Identity $identity): void
    {
        $status = $row['status'] ?? null;
        $wasVerified = ($previous['status'] ?? null) === 'verified';

        if ($table === 'penalty_payment_records' && $status === 'verified' && !$wasVerified) {
            self::creditWallet('penalty_wallet', (float) $row['amount']);
        }
        if ($table === 'donation_payment_records' && $status === 'verified' && !$wasVerified) {
            self::creditWallet('donation_wallet', (float) $row['amount']);
        }
        if ($table === 'operational_payment_records' && $status === 'verified' && !$wasVerified) {
            self::creditWallet('operational_wallet', (float) $row['amount']);
        }
        if ($table === 'penalty_withdrawals' && $status === 'completed' && ($previous['status'] ?? null) !== 'completed') {
            self::debitWallet('penalty_wallet', (float) $row['amount']);
        }
        if ($table === 'donation_withdrawals' && $status === 'completed' && ($previous['status'] ?? null) !== 'completed') {
            self::debitWallet('donation_wallet', (float) $row['amount']);
        }
        if ($table === 'operational_withdrawals' && $status === 'completed' && ($previous['status'] ?? null) !== 'completed') {
            self::debitWallet('operational_wallet', (float) $row['amount']);
        }
        if ($table === 'beneficiary_requests') {
            self::beneficiaryNotifications($row, $previous);
        }
    }

    public static function memoReference(): string
    {
        $year = gmdate('Y');
        $count = (int) Database::value('SELECT COUNT(*) FROM memos WHERE YEAR(created_at) = ?', [$year]);
        return sprintf('KHCWW-MEMO-%s-%03d', $year, $count + 1);
    }

    private static function walletTransaction(array $row): array
    {
        $gross = (float) ($row['gross_amount'] ?? 0);
        $charge = (float) ($row['mpesa_charge'] ?? 0);
        $fee = (float) ($row['system_fee'] ?? 0);
        $direction = $row['direction'] ?? 'in';

        if (empty($row['net_amount'])) {
            $row['net_amount'] = $direction === 'in' ? $gross - $charge - $fee : $gross + $charge + $fee;
        }
        $previous = (float) (Database::value(
            'SELECT running_balance FROM wallet_transactions WHERE wallet_type = ? ORDER BY occurred_at DESC, created_at DESC LIMIT 1',
            [$row['wallet_type'] ?? 'operational']
        ) ?? 0);
        $net = (float) $row['net_amount'];
        $row['running_balance'] = $direction === 'in' ? $previous + $net : $previous - $net;
        return $row;
    }

    private static function creditWallet(string $wallet, float $amount): void
    {
        self::ensureWalletRow($wallet);
        Database::run(sprintf(
            'UPDATE `%s` SET total_received = COALESCE(total_received,0) + ?, total_balance = COALESCE(total_balance,0) + ?%s',
            $wallet,
            self::walletTimestampClause($wallet)
        ), [$amount, $amount]);
    }

    private static function debitWallet(string $wallet, float $amount): void
    {
        self::ensureWalletRow($wallet);
        Database::run(sprintf(
            'UPDATE `%s` SET total_withdrawn = COALESCE(total_withdrawn,0) + ?, total_balance = COALESCE(total_balance,0) - ?%s',
            $wallet,
            self::walletTimestampClause($wallet)
        ), [abs($amount), abs($amount)]);
    }

    private static function walletTimestampClause(string $wallet): string
    {
        $columns = Database::columns($wallet);
        if (in_array('updated_at', $columns, true)) {
            return ', updated_at = UTC_TIMESTAMP(3)';
        }
        if (in_array('last_updated', $columns, true)) {
            return ', last_updated = UTC_TIMESTAMP(3)';
        }
        return '';
    }

    private static function ensureWalletRow(string $wallet): void
    {
        $exists = (int) Database::value(sprintf('SELECT COUNT(*) FROM `%s`', $wallet));
        if ($exists === 0) {
            Database::run(sprintf('INSERT INTO `%s` (id) VALUES (?)', $wallet), [Uuid::v4()]);
        }
    }

    private static function beneficiaryNotifications(array $row, ?array $previous): void
    {
        $member = Database::one('SELECT name, user_id FROM members WHERE id = ?', [$row['member_id'] ?? '']);
        $memberName = $member['name'] ?? 'A member';

        if ($previous === null) {
            $admins = Database::all("SELECT DISTINCT user_id FROM user_roles WHERE role IN ('admin','super_admin')");
            foreach ($admins as $admin) {
                self::notify(
                    (string) $admin['user_id'],
                    'New beneficiary request',
                    sprintf('%s submitted a beneficiary %s request for review.', $memberName, $row['request_type'] ?? 'update'),
                    'beneficiary_request'
                );
            }
            return;
        }

        $status = $row['status'] ?? null;
        if ($status !== ($previous['status'] ?? null) && in_array($status, ['approved', 'rejected'], true) && !empty($member['user_id'])) {
            $note = trim((string) ($row['admin_notes'] ?? ''));
            self::notify(
                (string) $member['user_id'],
                'Beneficiary request ' . $status,
                sprintf(
                    'Your beneficiary %s request has been %s%s',
                    $row['request_type'] ?? 'update',
                    $status,
                    $note !== '' ? '. Note: ' . $note : '.'
                ),
                'beneficiary_' . $status
            );
        }
    }

    public static function notify(string $userId, string $title, string $message, string $type = 'info'): void
    {
        Database::run(
            'INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, UTC_TIMESTAMP(3))',
            [Uuid::v4(), $userId, $title, $message, $type]
        );
    }
}
