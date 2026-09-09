<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Support\AuthService;
use App\Support\Db;
use App\Support\Uuid;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** /storage/v1/object/{bucket}/{path} - local disk file storage. */
final class StorageController extends Controller
{
    private const PUBLIC_BUCKETS = ['chat-attachments', 'profile-images', 'signatures'];

    private const BUCKETS = ['chat-attachments', 'profile-images', 'signatures', 'documents'];

    private const ALLOWED = [
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt',
    ];

    public function upload(Request $request, string $bucket, string $path): JsonResponse
    {
        $identity = AuthService::require();
        $this->assertBucket($bucket);

        $file = $request->file('file');
        if ($file === null || ! $file->isValid()) {
            throw new ApiException(400, 'no_file', 'Attach the file as multipart form field "file"');
        }

        $maxBytes = (int) config('welfare.max_upload_mb') * 1024 * 1024;
        if ($file->getSize() > $maxBytes) {
            throw new ApiException(413, 'file_too_large', 'File exceeds the maximum allowed size');
        }

        $path = $this->safePath($path);
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        if (! in_array($extension, self::ALLOWED, true)) {
            throw new ApiException(415, 'unsupported_type', 'This file type is not allowed');
        }

        $target = $this->root().'/'.$bucket.'/'.$path;
        $dir = dirname($target);
        if (! is_dir($dir) && ! mkdir($dir, 0755, true) && ! is_dir($dir)) {
            throw new ApiException(500, 'storage_error', 'Could not create the storage directory');
        }

        $size = (int) $file->getSize();
        $mime = $file->getClientMimeType();
        $file->move($dir, basename($target));

        Db::run(
            'INSERT INTO storage_objects (id, bucket, object_path, mime_type, size_bytes, is_public, owner_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), size_bytes = VALUES(size_bytes), owner_id = VALUES(owner_id)',
            [Uuid::v4(), $bucket, $path, $mime, $size, in_array($bucket, self::PUBLIC_BUCKETS, true) ? 1 : 0, $identity->userId]
        );

        return response()->json([
            'bucket' => $bucket,
            'path' => $path,
            'public_url' => $this->publicUrl($bucket, $path),
        ], 201);
    }

    public function download(string $bucket, string $path): BinaryFileResponse
    {
        $this->assertBucket($bucket);
        $path = $this->safePath($path);

        if (! in_array($bucket, self::PUBLIC_BUCKETS, true)) {
            AuthService::require(); // private buckets (documents) need a session
        }

        $file = $this->root().'/'.$bucket.'/'.$path;
        if (! is_file($file)) {
            throw new ApiException(404, 'not_found', 'File not found');
        }

        $mime = Db::value(
            'SELECT mime_type FROM storage_objects WHERE bucket = ? AND object_path = ?',
            [$bucket, $path]
        );

        return response()->file($file, [
            'Content-Type' => $mime ?: 'application/octet-stream',
            'Cache-Control' => 'private, max-age=600',
        ]);
    }

    public function remove(string $bucket, string $path): JsonResponse
    {
        AuthService::requireRole('admin', 'super_admin', 'treasurer', 'secretary');
        $this->assertBucket($bucket);
        $path = $this->safePath($path);

        $file = $this->root().'/'.$bucket.'/'.$path;
        if (is_file($file)) {
            unlink($file);
        }
        Db::run('DELETE FROM storage_objects WHERE bucket = ? AND object_path = ?', [$bucket, $path]);

        return response()->json(['success' => true]);
    }

    public function publicUrl(string $bucket, string $path): string
    {
        return rtrim((string) config('welfare.storage_public_url'), '/').'/'.$bucket.'/'.$path;
    }

    private function assertBucket(string $bucket): void
    {
        if (! in_array($bucket, self::BUCKETS, true)) {
            throw new ApiException(404, 'unknown_bucket', sprintf('Bucket "%s" does not exist', $bucket));
        }
    }

    private function safePath(string $path): string
    {
        $path = ltrim(str_replace('\\', '/', $path), '/');
        if ($path === '' || str_contains($path, '..')) {
            throw new ApiException(400, 'invalid_path', 'Invalid object path');
        }

        return preg_replace('/[^A-Za-z0-9._\-\/]/', '_', $path) ?? $path;
    }

    private function root(): string
    {
        $root = (string) config('welfare.storage_path');
        if (! str_starts_with($root, '/')) {
            $root = base_path($root);
        }
        if (! is_dir($root)) {
            mkdir($root, 0755, true);
        }

        return rtrim($root, '/');
    }
}
