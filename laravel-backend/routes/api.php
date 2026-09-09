<?php

declare(strict_types=1);

use App\Http\Controllers\AuthController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\RestController;
use App\Http\Controllers\RpcController;
use App\Http\Controllers\StorageController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| KHCWW Welfare API
|--------------------------------------------------------------------------
| Paths mirror the shapes the React app already calls:
|   /health
|   /auth/v1/{token,signup,user,logout,password}
|   /rest/v1/{table}[/{id}]           GET POST PATCH PUT DELETE
|   /rest/v1/rpc/{name}   /rpc/{name} POST
|   /storage/v1/object/{bucket}/{path}
*/

Route::get('/', [HealthController::class, 'index']);
Route::get('/health', [HealthController::class, 'index']);

Route::prefix('auth/v1')->group(function (): void {
    Route::post('/token', [AuthController::class, 'token']);
    Route::post('/signup', [AuthController::class, 'signup']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/password', [AuthController::class, 'changePassword']);
});

Route::post('/rest/v1/rpc/{name}', [RpcController::class, 'handle']);
Route::post('/rpc/{name}', [RpcController::class, 'handle']);

Route::match(['get', 'post', 'patch', 'put', 'delete'], '/rest/v1/{table}', [RestController::class, 'handle']);
Route::match(['get', 'patch', 'put', 'delete'], '/rest/v1/{table}/{id}', [RestController::class, 'handle']);

Route::post('/storage/v1/object/{bucket}/{path}', [StorageController::class, 'upload'])->where('path', '.*');
Route::get('/storage/v1/object/{bucket}/{path}', [StorageController::class, 'download'])->where('path', '.*');
Route::delete('/storage/v1/object/{bucket}/{path}', [StorageController::class, 'remove'])->where('path', '.*');

Route::post('/storage/{bucket}/{path}', [StorageController::class, 'upload'])->where('path', '.*');
Route::get('/storage/{bucket}/{path}', [StorageController::class, 'download'])->where('path', '.*');
Route::delete('/storage/{bucket}/{path}', [StorageController::class, 'remove'])->where('path', '.*');
