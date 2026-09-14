<?php

declare(strict_types=1);

namespace App\Domain\Errors;

use App\Shared\Enum\HttpStatus;

/**
 * Tipo de arquivo fora da allowlist.

 * O tipo é apurado pelo CONTEÚDO do arquivo, nunca pela extensão — extensão é
 * dado do cliente, e dado do cliente mente.
 */
final class UnsupportedMediaTypeError extends DomainError
{
    public function status(): HttpStatus
    {
        return HttpStatus::UNSUPPORTED_MEDIA_TYPE;
    }
}
