<?php
declare(strict_types=1);

namespace App;

/** /storage/v1/object/{bucket}/{path} - local disk replacement for Supabase Storage. */
final class StorageController
{
    private const PUBLIC_BUCKETS = ['chat-attachments', 'profile-images', 'signatures'];
    private const BUCKETS = ['chat-attachments', 'profile-images', 'signatures', 'documents'];
    private const ALLOWED = [
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt',
    ];

    public static function upload(string $bucket, string $path): void
    {
        $identity = Auth::require();
        self::assertBucket($bucket);

        if (!isset($_FILES['file'])) {
            throw new HttpException(400, 'no_file', 'Attach the file as multipart form field "file"');
        }
        $file = $_FILES['file'];
        if ((int) $file['error'] !== UPLOAD_ERR_OK) {
            throw new HttpException(400, 'upload_failed', 'Upload failed with error code ' . $file['error']);
        }
        $maxBytes = Env::int('MAX_UPLOAD_MB', 15) * 1024 * 1024;
        if ((int) $file['size'] > $maxBytes) {
            throw new HttpException(413, 'file_too_large', 'File exceeds the maximum allowed size');
        }

        $path = self::safePath($path);
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        if (!in_array($extension, self::ALLOWED, true)) {
            throw new HttpException(415, 'unsupported_type', 'This file type is not allowed');
        }

        $target = self::root() . '/' . $bucket . '/' . $path;
        if (!is_dir(dirname($target)) && !mkdir(dirname($target), 0755, true) && !is_dir(dirname($target))) {
            throw new HttpException(500, 'storage_error', 'Could not create the storage directory');
        }
        if (!move_uploaded_file($file['tmp_name'], $target)) {
            throw new HttpException(500, 'storage_error', 'Could not save the uploaded file');
        }

        $isPublic = in_array($bucket, self::PUBLIC_BUCKETS, true);
        Database::run(
            'INSERT INTO storage_objects (id, bucket, object_path, mime_type, size_bytes, is_public, owner_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), size_bytes = VALUES(size_bytes), owner_id = VALUES(owner_id)',
            [Uuid::v4(), $bucket, $path, $file['type'] ?? null, (int) $file['size'], $isPublic ? 1 : 0, $identity->userId]
        );

        Response::json([
            'bucket' => $bucket,
            'path' => $path,
            'public_url' => self::publicUrl($bucket, $path),
        ], 201);
    }

    public static function download(string $bucket, string $path): void
    {
        self::assertBucket($bucket);
        $path = self::safePath($path);

        if (!in_array($bucket, self::PUBLIC_BUCKETS, true)) {
            Auth::require(); // private buckets (documents) need a session
        }

        $file = self::root() . '/' . $bucket . '/' . $path;
        if (!is_file($file)) {
            throw new HttpException(404, 'not_found', 'File not found');
        }

        $mime = Database::value('SELECT mime_type FROM storage_objects WHERE bucket = ? AND object_path = ?', [$bucket, $path]);
        header('Content-Type: ' . ($mime ?: 'application/octet-stream'));
        header('Content-Length: ' . filesize($file));
        header('Cache-Control: private, max-age=600');
        readfile($file);
    }

    public static function remove(string $bucket, string $path): void
    {
        Auth::requireRole('admin', 'super_admin', 'treasurer', 'secretary');
        self::assertBucket($bucket);
        $path = self::safePath($path);
        $file = self::root() . '/' . $bucket . '/' . $path;
        if (is_file($file)) {
            unlink($file);
        }
        Database::run('DELETE FROM storage_objects WHERE bucket = ? AND object_path = ?', [$bucket, $path]);
        Response::json(['success' => true]);
    }

    public static function publicUrl(string $bucket, string $path): string
    {
        return rtrim((string) Env::get('STORAGE_PUBLIC_URL', '/storage'), '/') . '/' . $bucket . '/' . $path;
    }

    private static function assertBucket(string $bucket): void
    {
        if (!in_array($bucket, self::BUCKETS, true)) {
            throw new HttpException(404, 'unknown_bucket', sprintf('Bucket "%s" does not exist', $bucket));
        }
    }

    private static function safePath(string $path): string
    {
        $path = ltrim(str_replace('\\', '/', $path), '/');
        if ($path === '' || str_contains($path, '..')) {
            throw new HttpException(400, 'invalid_path', 'Invalid object path');
        }
        return preg_replace('/[^A-Za-z0-9._\-\/]/', '_', $path) ?? $path;
    }

    private static function root(): string
    {
        $configured = (string) Env::get('STORAGE_PATH', 'storage');
        $root = str_starts_with($configured, '/') ? $configured : dirname(__DIR__) . '/' . $configured;
        if (!is_dir($root)) {
            mkdir($root, 0755, true);
        }
        return rtrim($root, '/');
    }
}
