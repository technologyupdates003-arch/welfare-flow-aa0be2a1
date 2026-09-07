<?php

return [
    'jwt_secret' => env('JWT_SECRET', ''),
    'jwt_issuer' => env('JWT_ISSUER', 'khcww-welfare'),
    'jwt_ttl' => (int) env('JWT_TTL', 3600),
    'refresh_ttl' => (int) env('REFRESH_TTL', 2592000),

    'default_member_password' => env('DEFAULT_MEMBER_PASSWORD', 'Member2026'),

    'storage_path' => env('STORAGE_PATH', storage_path('app/welfare')),
    'storage_public_url' => env('STORAGE_PUBLIC_URL', '/api/storage/v1/object'),
    'max_upload_mb' => (int) env('MAX_UPLOAD_MB', 15),
];
