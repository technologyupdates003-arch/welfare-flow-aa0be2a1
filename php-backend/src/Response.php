<?php
declare(strict_types=1);

namespace App;

final class Response
{
    public static function json($data, int $status = 200, array $headers = []): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        foreach ($headers as $key => $value) {
            header($key . ': ' . $value);
        }
        echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
    }

    public static function error(int $status, string $code, string $message): void
    {
        self::json(['error' => ['code' => $code, 'message' => $message]], $status);
    }

    public static function noContent(): void
    {
        http_response_code(204);
    }

    public static function cors(): void
    {
        $allowed = Env::get('CORS_ORIGINS', '*');
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($allowed === '*' || $allowed === null) {
            header('Access-Control-Allow-Origin: *');
        } else {
            $list = array_map('trim', explode(',', $allowed));
            if ($origin !== '' && in_array($origin, $list, true)) {
                header('Access-Control-Allow-Origin: ' . $origin);
                header('Vary: Origin');
            }
        }
        header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With, Prefer, apikey');
        header('Access-Control-Expose-Headers: Content-Range, X-Total-Count');
        header('Access-Control-Max-Age: 86400');
    }
}
