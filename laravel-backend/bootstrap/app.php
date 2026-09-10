<?php

use App\Exceptions\ApiException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: '',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);
        $middleware->statefulApi(false);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (ApiException $e) {
            return $e->render();
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('*') || $request->isMethod('OPTIONS')) {
                return null;
            }

            if ($e instanceof AuthenticationException) {
                return response()->json([
                    'error' => ['code' => 'unauthorized', 'message' => 'Authentication required'],
                ], 401);
            }

            $status = $e instanceof HttpExceptionInterface ? $e->getStatusCode() : 500;
            $code = match ($status) {
                404 => 'not_found',
                405 => 'method_not_allowed',
                default => 'server_error',
            };

            $message = $status === 500 && ! config('app.debug')
                ? 'Unexpected server error'
                : $e->getMessage();

            if ($status === 404 && $message === '') {
                $message = 'Unknown endpoint: '.$request->path();
            }

            return response()->json([
                'error' => ['code' => $code, 'message' => $message],
            ], $status);
        });
    })->create();
