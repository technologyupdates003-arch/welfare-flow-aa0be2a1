<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Support\AuthService;
use App\Support\Casts;
use App\Support\Db;
use App\Support\Hooks;
use App\Support\Identity;
use App\Support\Policy;
use App\Support\QueryBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** CRUD endpoints: /rest/v1/{table} and /rest/v1/{table}/{id} */
final class RestController extends Controller
{
    public function handle(Request $request, string $table, ?string $id = null): JsonResponse
    {
        Policy::rules($table); // 404s unknown tables

        $query = $request->query();
        if ($id !== null && $id !== '') {
            $query['id'] = 'eq.'.$id;
        }
        $body = $request->all();
        $method = strtoupper($request->method());

        return match ($method) {
            'GET' => $this->read($table, $query),
            'POST' => $this->insert($table, $body, AuthService::identity()),
            'PATCH', 'PUT' => $this->update($table, $query, $body, AuthService::require()),
            'DELETE' => $this->delete($table, $query, AuthService::require()),
            default => throw new ApiException(405, 'method_not_allowed', 'Unsupported method '.$method),
        };
    }

    private function read(string $table, array $query): JsonResponse
    {
        if (($query['count'] ?? '') === 'exact') {
            return response()->json(['count' => QueryBuilder::count($table, $query, AuthService::require())]);
        }

        return response()->json(QueryBuilder::select($table, $query, AuthService::require()));
    }

    private function insert(string $table, array $body, Identity $identity): JsonResponse
    {
        $isPublic = Policy::allowsPublicInsert($table);
        if (! $isPublic) {
            $identity = AuthService::require();
        }

        $rows = array_is_list($body) ? $body : [$body];
        if ($rows === []) {
            throw new ApiException(400, 'empty_payload', 'No rows to insert');
        }

        $inserted = Db::transaction(static function () use ($rows, $table, $identity, $isPublic) {
            $result = [];
            foreach ($rows as $raw) {
                if (! is_array($raw)) {
                    throw new ApiException(400, 'invalid_payload', 'Rows must be objects');
                }
                $row = Casts::payload($table, $raw);
                if (! $isPublic) {
                    Policy::assertWrite($table, $row, $identity, 'insert');
                }
                $row = Hooks::beforeInsert($table, $row, $identity);

                $cols = array_keys($row);
                $sql = sprintf(
                    'INSERT INTO `%s` (%s) VALUES (%s)',
                    $table,
                    implode(', ', array_map(static fn ($c) => '`'.$c.'`', $cols)),
                    implode(', ', array_fill(0, count($cols), '?'))
                );
                Db::run($sql, array_values($row));

                $stored = Db::one(sprintf('SELECT * FROM `%s` WHERE id = ?', $table), [$row['id']]);
                if ($stored !== null) {
                    Hooks::afterWrite($table, $stored, null, $identity);
                    $result[] = Casts::out($table, $stored);
                }
            }

            return $result;
        });

        return response()->json($inserted, 201);
    }

    private function update(string $table, array $query, array $body, Identity $identity): JsonResponse
    {
        $targets = QueryBuilder::select($table, array_merge($query, ['select' => '*']), $identity);
        if ($targets === []) {
            return response()->json([]);
        }

        $changes = Casts::payload($table, $body);
        if ($changes === []) {
            throw new ApiException(400, 'empty_payload', 'Nothing to update');
        }
        unset($changes['id'], $changes['created_at']);
        $changes = Hooks::beforeUpdate($table, $changes);

        $updated = Db::transaction(static function () use ($targets, $changes, $table, $identity) {
            $result = [];
            foreach ($targets as $previous) {
                Policy::assertWrite($table, $previous, $identity, 'update');
                $sql = sprintf(
                    'UPDATE `%s` SET %s WHERE id = ?',
                    $table,
                    implode(', ', array_map(static fn ($c) => sprintf('`%s` = ?', $c), array_keys($changes)))
                );
                Db::run($sql, array_merge(array_values($changes), [$previous['id']]));

                $stored = Db::one(sprintf('SELECT * FROM `%s` WHERE id = ?', $table), [$previous['id']]);
                if ($stored !== null) {
                    Hooks::afterWrite($table, $stored, $previous, $identity);
                    $result[] = Casts::out($table, $stored);
                }
            }

            return $result;
        });

        return response()->json($updated);
    }

    private function delete(string $table, array $query, Identity $identity): JsonResponse
    {
        $targets = QueryBuilder::select($table, array_merge($query, ['select' => '*']), $identity);
        if ($targets === []) {
            return response()->json([]);
        }

        Db::transaction(static function () use ($targets, $table, $identity) {
            foreach ($targets as $row) {
                Policy::assertWrite($table, $row, $identity, 'delete');
                Db::run(sprintf('DELETE FROM `%s` WHERE id = ?', $table), [$row['id']]);
            }
        });

        return response()->json($targets);
    }
}
