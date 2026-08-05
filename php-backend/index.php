<?php
declare(strict_types=1);

/**
 * Same-folder deployment front controller.
 *
 * Upload the whole php-backend folder to public_html/api so the API is served
 * from https://welafarewebsit.neibasconsortium.co.ke/api/... alongside the
 * React frontend, with no api. subdomain required.
 */
require __DIR__ . '/public/index.php';
