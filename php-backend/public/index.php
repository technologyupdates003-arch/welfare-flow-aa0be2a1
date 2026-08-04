<?php
declare(strict_types=1);

/**
 * KHCWW Welfare Management System - PHP API front controller.
 * Point the cPanel domain/subdomain document root at this folder.
 */

use App\AuthController;
use App\Auth;
use App\Database;
use App\Env;
use App\HttpException;
use App\Response;
use App\RestController;
use App\RpcController;
use App\StorageController;

require __DIR__ . '/../src/bootstrap.php';

Response::cors();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if ($base !== '' && str_starts_with($uri, $base)) {
    $uri = substr($uri, strlen($base));
}
$segments = array_values(array_filter(explode('/', trim($uri, '/')), static fn ($s) => $s !== ''));

$rawBody = file_get_contents('php://input') ?: '';
$body = [];
if ($rawBody !== '') {
    $decoded = json_decode($rawBody, true);
    if (is_array($decoded)) {
        $body = $decoded;
    }
}
if ($body === [] && $_POST !== []) {
    $body = $_POST;
}
$query = $_GET;

try {
    $head = $segments[0] ?? '';

    // --- health check -------------------------------------------------
    if ($head === '' || $head === 'health') {
        Response::json([
            'status' => 'ok',
            'service' => 'khcww-welfare-api',
            'database' => Database::tableExists('members') ? 'connected' : 'schema_missing',
            'time' => gmdate('c'),
        ]);
        exit;
    }

    // --- auth ---------------------------------------------------------
    if ($head === 'auth' && ($segments[1] ?? '') === 'v1') {
        $action = $segments[2] ?? '';
        match (true) {
            $action === 'token' && $method === 'POST' => AuthController::token($body, $query),
            $action === 'signup' && $method === 'POST' => AuthController::signup($body),
            $action === 'user' && $method === 'GET' => AuthController::user(),
            $action === 'logout' && $method === 'POST' => AuthController::logout(),
            $action === 'password' && $method === 'POST' => AuthController::changePassword($body),
            default => throw new HttpException(404, 'not_found', 'Unknown auth endpoint'),
        };
        exit;
    }

    // --- rest ---------------------------------------------------------
    if ($head === 'rest' && ($segments[1] ?? '') === 'v1') {
        $table = $segments[2] ?? '';
        if ($table === 'rpc') {
            RpcController::handle($segments[3] ?? '', $body);
            exit;
        }
        if ($table === '') {
            throw new HttpException(404, 'not_found', 'No table specified');
        }
        // /rest/v1/members/{id} shorthand
        if (isset($segments[3]) && $segments[3] !== '') {
            $query['id'] = 'eq.' . $segments[3];
        }
        RestController::handle($method, $table, $query, $body);
        exit;
    }

    if ($head === 'rpc') {
        RpcController::handle($segments[1] ?? '', $body);
        exit;
    }

    // --- storage ------------------------------------------------------
    if ($head === 'storage') {
        $offset = ($segments[1] ?? '') === 'v1' ? 2 : 1;
        if (($segments[$offset] ?? '') === 'object') {
            $offset++;
        }
        $bucket = $segments[$offset] ?? '';
        $path = implode('/', array_slice($segments, $offset + 1));
        match ($method) {
            'POST' => StorageController::upload($bucket, $path),
            'GET' => StorageController::download($bucket, $path),
            'DELETE' => StorageController::remove($bucket, $path),
            default => throw new HttpException(405, 'method_not_allowed', 'Unsupported method'),
        };
        exit;
    }

    throw new HttpException(404, 'not_found', 'Unknown endpoint: /' . implode('/', $segments));
} catch (HttpException $e) {
    Response::error($e->status, $e->errorCode, $e->getMessage());
} catch (Throwable $e) {
    error_log('[khcww-api] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    Response::error(
        500,
        'server_error',
        Env::bool('APP_DEBUG') ? $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine() : 'Unexpected server error'
    );
}
