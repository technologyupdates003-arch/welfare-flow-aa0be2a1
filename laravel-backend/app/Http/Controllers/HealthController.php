<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Db;
use Illuminate\Http\JsonResponse;

final class HealthController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'service' => 'khcww-welfare-api',
            'framework' => 'laravel '.app()->version(),
            'database' => Db::tableExists('members') ? 'connected' : 'schema_missing',
            'time' => gmdate('c'),
        ]);
    }
}
