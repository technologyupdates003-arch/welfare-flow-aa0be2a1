<?php
declare(strict_types=1);

namespace App;

/** CRUD endpoints: /rest/v1/{table} */
final class RestController
{
    public static function handle(string $method, string $table, array $query, array $body): void
    {
        Policy::rules($table); // 404s unknown tables
        $identity = Auth::identity();

        switch ($method) {
            case 'GET':
                if (($query['count'] ?? '') === 'exact') {
                    Response::json(['count' => QueryBuilder::count($table, $query, Auth::require())]);
                    return;
                }
                Response::json(QueryBuilder::select($table, $query, Auth::require()));
                return;

            case 'POST':
                self::insert($table, $body, $identity);
                return;

            case 'PATCH':
            case 'PUT':
                self::update($table, $query, $body, Auth::require());
                return;

            case 'DELETE':
                self::delete($table, $query, Auth::require());
                return;

            default:
                throw new HttpException(405, 'method_not_allowed', 'Unsupported method ' . $method);
        }
    }

    private static function insert(string $table, array $body, Identity $identity): void
    {
        $isPublic = Policy::allowsPublicInsert($table);
        if (!$isPublic) {
            $identity = Auth::require();
        }

        $rows = array_is_list($body) ? $body : [$body];
        if ($rows === []) {
            throw new HttpException(400, 'empty_payload', 'No rows to insert');
        }

        $inserted = Database::transaction(static function () use ($rows, $table, $identity, $isPublic) {
            $result = [];
            foreach ($rows as $raw) {
                if (!is_array($raw)) {
                    throw new HttpException(400, 'invalid_payload', 'Rows must be objects');
                }
                $row = Casts::payload($table, $raw);
                if (!$isPublic) {
                    Policy::assertWrite($table, $row, $identity, 'insert');
                } 
                $row = Hooks::beforeInsert($table, $row, $identity);

                $cols = array_keys($row);
                $sql = sprintf(
                    'INSERT INTO `%s` (%s) VALUES (%s)',
                    $table,
                    implode(', ', array_map(static fn ($c) => '`' . $c . '`', $cols)),
                    implode(', ', array_fill(0, count($cols), '?'))
                );
                Database::run($sql, array_values($row));

                $stored = Database::one(sprintf('SELECT * FROM `%s` WHERE id = ?', $table), [$row['id']]);
                if ($stored !== null) {
                    Hooks::afterWrite($table, $stored, null, $identity);
                    $result[] = Casts::out($table, $stored);
                }
            }
            return $result;
        });

        Response::json($inserted, 201);
    }

    private static function update(string $table, array $query, array $body, Identity $identity): void
    {
        $targets = QueryBuilder::select($table, array_merge($query, ['select' => '*']), $identity);
        if ($targets === []) {
            Response::json([]);
            return;
        }

        $changes = Casts::payload($table, $body);
        if ($changes === []) {
            throw new HttpException(400, 'empty_payload', 'Nothing to update');
        }
        unset($changes['id'], $changes['created_at']);
        $changes = Hooks::beforeUpdate($table, $changes);

        $updated = Database::transaction(static function () use ($targets, $changes, $table, $identity) {
            $result = [];
            foreach ($targets as $previous) {
                Policy::assertWrite($table, $previous, $identity, 'update');
                $sql = sprintf(
                    'UPDATE `%s` SET %s WHERE id = ?',
                    $table,
                    implode(', ', array_map(static fn ($c) => sprintf('`%s` = ?', $c), array_keys($changes)))
                );
                Database::run($sql, array_merge(array_values($changes), [$previous['id']]));

                $stored = Database::one(sprintf('SELECT * FROM `%s` WHERE id = ?', $table), [$previous['id']]);
                if ($stored !== null) {
                    Hooks::afterWrite($table, $stored, $previous, $identity);
                    $result[] = Casts::out($table, $stored);
                }
            }
            return $result;
        });

        Response::json($updated);
    }

    private static function delete(string $table, array $query, Identity $identity): void
    {
        $targets = QueryBuilder::select($table, array_merge($query, ['select' => '*']), $identity);
        if ($targets === []) {
            Response::json([]);
            return;
        }
        Database::transaction(static function () use ($targets, $table, $identity) {
            foreach ($targets as $row) {
                Policy::assertWrite($table, $row, $identity, 'delete');
                Database::run(sprintf('DELETE FROM `%s` WHERE id = ?', $table), [$row['id']]);
            }
        });
        Response::json($targets);
    }
}
