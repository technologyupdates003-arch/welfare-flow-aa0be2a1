<?php

declare(strict_types=1);

namespace App\Support;

use App\Exceptions\ApiException;
use Illuminate\Support\Facades\DB;
use Throwable;

/** Thin array-shaped helper over the Laravel database connection. */
final class Db
{
    /** @var array<string, array<int,string>> */
    private static array $columnCache = [];

    /** @return array<int,array<string,mixed>> */
    public static function all(string $sql, array $params = []): array
    {
        try {
            return array_map(
                static fn ($row) => (array) $row,
                DB::select($sql, array_values($params))
            );
        } catch (Throwable $e) {
            throw self::wrap($e);
        }
    }

    public static function one(string $sql, array $params = []): ?array
    {
        return self::all($sql, $params)[0] ?? null;
    }

    public static function value(string $sql, array $params = []): mixed
    {
        $row = self::one($sql, $params);
        if ($row === null) {
            return null;
        }

        return array_values($row)[0] ?? null;
    }

    /** Runs INSERT/UPDATE/DELETE and returns affected rows. */
    public static function run(string $sql, array $params = []): int
    {
        try {
            return DB::affectingStatement($sql, array_values($params));
        } catch (Throwable $e) {
            throw self::wrap($e);
        }
    }

    public static function transaction(callable $fn): mixed
    {
        return DB::transaction(static fn () => $fn());
    }

    public static function tableExists(string $table): bool
    {
        $count = self::value(
            'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
            [$table]
        );

        return (int) $count > 0;
    }

    /** @return array<int,string> */
    public static function columns(string $table): array
    {
        if (isset(self::$columnCache[$table])) {
            return self::$columnCache[$table];
        }

        $rows = self::all(
            'SELECT column_name FROM information_schema.columns
              WHERE table_schema = DATABASE() AND table_name = ?
              ORDER BY ordinal_position',
            [$table]
        );

        return self::$columnCache[$table] = array_map(
            static fn (array $r) => (string) ($r['column_name'] ?? $r['COLUMN_NAME']),
            $rows
        );
    }

    public static function forgetColumnCache(): void
    {
        self::$columnCache = [];
    }

    private static function wrap(Throwable $e): Throwable
    {
        if ($e instanceof ApiException) {
            return $e;
        }

        $isConnection = str_contains($e->getMessage(), 'SQLSTATE[HY000] [1045]')
            || str_contains($e->getMessage(), 'SQLSTATE[HY000] [2002]')
            || str_contains($e->getMessage(), 'Unknown database');

        if ($isConnection) {
            return new ApiException(500, 'database_unavailable', config('app.debug')
                ? $e->getMessage()
                : 'Could not connect to the database. Check the DB credentials in .env');
        }

        return $e;
    }
}
