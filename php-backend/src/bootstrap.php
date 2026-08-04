<?php
declare(strict_types=1);

/** Autoloader + environment bootstrap (no composer needed on cPanel). */

spl_autoload_register(static function (string $class): void {
    if (!str_starts_with($class, 'App\\')) {
        return;
    }
    $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, 4)) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

// Identity and HttpException live in shared files
require_once __DIR__ . '/HttpException.php';
require_once __DIR__ . '/Auth.php';

App\Env::load(dirname(__DIR__) . '/.env');

date_default_timezone_set('UTC');
ini_set('display_errors', App\Env::bool('APP_DEBUG') ? '1' : '0');
error_reporting(E_ALL);
