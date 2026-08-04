<?php
declare(strict_types=1);

namespace App;

/**
 * Translates between the JSON shapes the React app expects (Postgres flavoured)
 * and the way MariaDB stores the same data.
 */
final class Casts
{
    /** Columns stored as JSON text but exposed as arrays/objects. */
    private const JSON_COLUMNS = [
        'meeting_minutes' => ['attendees', 'absent_with_apology', 'absent_without_apology', 'visible_to_members'],
        'memos' => ['attachments'],
        'payouts' => ['supporting_documents'],
        'audit_logs' => ['details'],
        'system_logs' => ['error_details'],
        'system_health' => ['details'],
        'financial_reports' => ['report_data'],
        'memo_templates' => ['variables'],
        'organization_settings' => ['payout_rules'],
        'auth_users' => ['raw_user_meta_data'],
    ];

    private const BOOL_COLUMNS = [
        'is_active', 'is_read', 'is_paid', 'matched', 'resolved', 'active', 'allow_partial',
        'show_on_login', 'auto_approve', 'used', 'is_online', 'is_banned',
    ];

    /** Row coming out of the database -> API JSON. */
    public static function out(string $table, array $row): array
    {
        $jsonColumns = self::JSON_COLUMNS[$table] ?? [];
        foreach ($row as $key => $value) {
            if (in_array($key, $jsonColumns, true)) {
                $row[$key] = $value === null || $value === '' ? null : json_decode((string) $value, true);
                continue;
            }
            if (in_array($key, self::BOOL_COLUMNS, true) && $value !== null) {
                $row[$key] = (bool) $value;
                continue;
            }
            if (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/', $value)) {
                // ISO-8601 in UTC, exactly what supabase-js returned
                $row[$key] = str_replace(' ', 'T', $value) . 'Z';
                continue;
            }
            if (is_string($value) && is_numeric($value) && preg_match('/^-?\d+\.\d+$/', $value)) {
                $row[$key] = (float) $value;
            }
        }
        return $row;
    }

    /** API JSON value -> database value. */
    public static function in($value)
    {
        if (is_bool($value)) {
            return $value ? 1 : 0;
        }
        if (is_array($value)) {
            return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        if (is_string($value)) {
            if ($value === 'true') {
                return 1;
            }
            if ($value === 'false') {
                return 0;
            }
            if ($value === 'null') {
                return null;
            }
            // ISO timestamps -> MariaDB DATETIME (UTC)
            if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/', $value)) {
                $ts = strtotime($value);
                if ($ts !== false) {
                    return gmdate('Y-m-d H:i:s', $ts);
                }
            }
        }
        return $value;
    }

    /** Prepare an entire payload for insert/update. */
    public static function payload(string $table, array $payload): array
    {
        $columns = Database::columns($table);
        $clean = [];
        foreach ($payload as $key => $value) {
            if (!in_array($key, $columns, true)) {
                continue; // silently drop unknown columns, like PostgREST with a strict schema
            }
            $clean[$key] = self::in($value);
        }
        return $clean;
    }
}
