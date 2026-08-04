<?php
declare(strict_types=1);

namespace App;

/**
 * PostgREST-compatible query layer over MariaDB.
 *
 * Supported query string syntax (same shape the frontend already uses):
 *   ?select=id,name           -> column projection
 *   ?status=eq.active         -> operators: eq, neq, gt, gte, lt, lte, like, ilike, in, is
 *   ?order=created_at.desc    -> ordering (multiple allowed, comma separated)
 *   ?limit=50&offset=100      -> pagination
 *   ?or=(a.eq.1,b.eq.2)       -> OR group
 */
final class QueryBuilder
{
    private const OPERATORS = [
        'eq' => '=', 'neq' => '<>', 'gt' => '>', 'gte' => '>=', 'lt' => '<', 'lte' => '<=',
    ];

    public static function select(string $table, array $query, Identity $identity): array
    {
        $columns = Database::columns($table);
        if ($columns === []) {
            throw new HttpException(404, 'unknown_table', sprintf('Table "%s" does not exist in the database', $table));
        }

        $select = self::projection($query['select'] ?? '*', $columns);
        [$where, $params] = self::where($query, $columns);

        $scope = Policy::readScope($table, $identity);
        if ($scope !== null) {
            $where[] = $scope[0];
            $params = array_merge($params, $scope[1]);
        }

        $sql = sprintf('SELECT %s FROM `%s`', $select, $table);
        if ($where !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= self::order($query['order'] ?? null, $columns);

        $limit = isset($query['limit']) ? max(1, min((int) $query['limit'], 5000)) : 1000;
        $offset = isset($query['offset']) ? max(0, (int) $query['offset']) : 0;
        $sql .= sprintf(' LIMIT %d OFFSET %d', $limit, $offset);

        $rows = Database::all($sql, $params);

        return array_map(static fn (array $row) => Casts::out($table, $row), $rows);
    }

    public static function count(string $table, array $query, Identity $identity): int
    {
        $columns = Database::columns($table);
        [$where, $params] = self::where($query, $columns);
        $scope = Policy::readScope($table, $identity);
        if ($scope !== null) {
            $where[] = $scope[0];
            $params = array_merge($params, $scope[1]);
        }
        $sql = sprintf('SELECT COUNT(*) FROM `%s`', $table);
        if ($where !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        return (int) Database::value($sql, $params);
    }

    private static function projection(string $select, array $columns): string
    {
        $select = trim($select);
        if ($select === '' || $select === '*') {
            return '*';
        }
        $parts = [];
        foreach (explode(',', $select) as $piece) {
            $piece = trim($piece);
            // embedded resources (foo(bar)) are not supported - fall back to all columns
            if ($piece === '' || str_contains($piece, '(')) {
                return '*';
            }
            if (in_array($piece, $columns, true)) {
                $parts[] = sprintf('`%s`', $piece);
            }
        }
        return $parts === [] ? '*' : implode(', ', $parts);
    }

    /** @return array{0:array<int,string>,1:array<int,mixed>} */
    private static function where(array $query, array $columns): array
    {
        $where = [];
        $params = [];

        foreach ($query as $key => $value) {
            if (in_array($key, ['select', 'order', 'limit', 'offset', 'count'], true)) {
                continue;
            }
            if ($key === 'or' && is_string($value)) {
                [$fragment, $orParams] = self::orGroup($value, $columns);
                if ($fragment !== null) {
                    $where[] = $fragment;
                    $params = array_merge($params, $orParams);
                }
                continue;
            }
            if (!in_array($key, $columns, true) || !is_string($value)) {
                continue;
            }
            [$fragment, $bound] = self::condition($key, $value);
            if ($fragment !== null) {
                $where[] = $fragment;
                $params = array_merge($params, $bound);
            }
        }

        return [$where, $params];
    }

    /** @return array{0:?string,1:array<int,mixed>} */
    private static function condition(string $column, string $expression): array
    {
        $pos = strpos($expression, '.');
        $op = $pos === false ? 'eq' : substr($expression, 0, $pos);
        $value = $pos === false ? $expression : substr($expression, $pos + 1);
        $col = sprintf('`%s`', $column);

        if (isset(self::OPERATORS[$op])) {
            return [sprintf('%s %s ?', $col, self::OPERATORS[$op]), [Casts::in($value)]];
        }
        if ($op === 'like' || $op === 'ilike') {
            return [sprintf('%s LIKE ?', $col), [str_replace('*', '%', $value)]];
        }
        if ($op === 'in') {
            $items = array_filter(array_map(
                static fn ($v) => trim($v, " \t\n\r\0\x0B\"'"),
                explode(',', trim($value, '()'))
            ), static fn ($v) => $v !== '');
            if ($items === []) {
                return ['1 = 0', []];
            }
            $placeholders = implode(', ', array_fill(0, count($items), '?'));
            return [sprintf('%s IN (%s)', $col, $placeholders), array_values($items)];
        }
        if ($op === 'is') {
            $normalized = strtolower($value);
            if ($normalized === 'null') {
                return [sprintf('%s IS NULL', $col), []];
            }
            if ($normalized === 'not.null') {
                return [sprintf('%s IS NOT NULL', $col), []];
            }
            return [sprintf('%s = ?', $col), [Casts::in($normalized)]];
        }
        if ($op === 'not') {
            [$inner, $bound] = self::condition($column, $value);
            return $inner === null ? [null, []] : [sprintf('NOT (%s)', $inner), $bound];
        }

        return [sprintf('%s = ?', $col), [Casts::in($expression)]];
    }

    /** @return array{0:?string,1:array<int,mixed>} */
    private static function orGroup(string $raw, array $columns): array
    {
        $raw = trim($raw, '()');
        $fragments = [];
        $params = [];
        foreach (explode(',', $raw) as $clause) {
            $clause = trim($clause);
            $pos = strpos($clause, '.');
            if ($pos === false) {
                continue;
            }
            $column = substr($clause, 0, $pos);
            if (!in_array($column, $columns, true)) {
                continue;
            }
            [$fragment, $bound] = self::condition($column, substr($clause, $pos + 1));
            if ($fragment !== null) {
                $fragments[] = $fragment;
                $params = array_merge($params, $bound);
            }
        }
        if ($fragments === []) {
            return [null, []];
        }
        return ['(' . implode(' OR ', $fragments) . ')', $params];
    }

    private static function order(?string $order, array $columns): string
    {
        if ($order === null || trim($order) === '') {
            return '';
        }
        $parts = [];
        foreach (explode(',', $order) as $clause) {
            $bits = explode('.', trim($clause));
            $column = $bits[0] ?? '';
            if (!in_array($column, $columns, true)) {
                continue;
            }
            $direction = strtolower($bits[1] ?? 'asc') === 'desc' ? 'DESC' : 'ASC';
            $nulls = '';
            if (in_array('nullslast', array_map('strtolower', $bits), true)) {
                $nulls = sprintf('`%s` IS NULL, ', $column);
            }
            $parts[] = $nulls . sprintf('`%s` %s', $column, $direction);
        }
        return $parts === [] ? '' : ' ORDER BY ' . implode(', ', $parts);
    }
}
