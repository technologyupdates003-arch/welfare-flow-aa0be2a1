<?php

$origins = array_values(array_filter(array_map('trim', explode(',', (string) env('CORS_ORIGINS', '*')))));

return [
    'paths' => ['*'],
    'allowed_methods' => ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    'allowed_origins' => $origins === [] ? ['*'] : $origins,
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Authorization', 'Content-Type', 'X-Requested-With', 'Prefer', 'apikey', 'Accept'],
    'exposed_headers' => ['Content-Range', 'X-Total-Count'],
    'max_age' => 86400,
    'supports_credentials' => false,
];
