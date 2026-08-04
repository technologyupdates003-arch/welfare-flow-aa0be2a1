<?php
declare(strict_types=1);

namespace App;

/** Minimal, dependency-free HS256 JWT implementation. */
final class Jwt
{
    public static function encode(array $payload, ?int $ttl = null): string
    {
        $now = time();
        $ttl = $ttl ?? Env::int('JWT_TTL', 3600);
        $payload = array_merge([
            'iss' => Env::get('JWT_ISSUER', 'khcww-welfare'),
            'iat' => $now,
            'exp' => $now + $ttl,
        ], $payload);

        $header = self::b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $body = self::b64(json_encode($payload));
        $signature = self::b64(hash_hmac('sha256', $header . '.' . $body, self::secret(), true));

        return $header . '.' . $body . '.' . $signature;
    }

    public static function decode(string $token): array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new HttpException(401, 'invalid_token', 'Malformed token');
        }
        [$header, $body, $signature] = $parts;

        $expected = self::b64(hash_hmac('sha256', $header . '.' . $body, self::secret(), true));
        if (!hash_equals($expected, $signature)) {
            throw new HttpException(401, 'invalid_token', 'Invalid token signature');
        }

        $payload = json_decode(self::unb64($body), true);
        if (!is_array($payload)) {
            throw new HttpException(401, 'invalid_token', 'Invalid token payload');
        }
        if (isset($payload['exp']) && time() >= (int) $payload['exp']) {
            throw new HttpException(401, 'token_expired', 'Session expired, please sign in again');
        }
        return $payload;
    }

    private static function secret(): string
    {
        $secret = Env::get('JWT_SECRET', '');
        if ($secret === null || strlen($secret) < 16) {
            throw new HttpException(500, 'config_error', 'JWT_SECRET is missing or too short in .env');
        }
        return $secret;
    }

    private static function b64(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    private static function unb64(string $raw): string
    {
        return base64_decode(strtr($raw, '-_', '+/')) ?: '';
    }
}
