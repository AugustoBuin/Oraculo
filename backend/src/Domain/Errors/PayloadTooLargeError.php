<?php

declare(strict_types=1);

namespace App\Domain\Errors;

use App\Shared\Enum\HttpStatus;

/**
 * Upload acima do limite de UPLOAD_MAX_BYTES.

 * Verificado ANTES de gravar qualquer byte em disco.
 */
final class PayloadTooLargeError extends DomainError
{
    public function status(): HttpStatus
    {
        return HttpStatus::PAYLOAD_TOO_LARGE;
    }
}
