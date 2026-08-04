<?php
declare(strict_types=1);

namespace App;

final class HttpException extends \RuntimeException
{
    public readonly int $status;
    public readonly string $errorCode;

    public function __construct(int $status, string $code, string $message)
    {
        parent::__construct($message, $status);
        $this->status = $status;
        $this->errorCode = $code;
    }
}
