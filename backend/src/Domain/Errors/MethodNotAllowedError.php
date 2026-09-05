<?php

declare(strict_types=1);

namespace App\Domain\Errors;

use App\Shared\Enum\HttpStatus;

/**
 * O caminho existe, mas não atende este verbo.
 *
 * 405 e não 404: responder 404 esconderia do cliente que o problema é o método,
 * e mandaria quem integra procurar um caminho que já está certo.
 */
final class MethodNotAllowedError extends DomainError
{
    public function status(): HttpStatus
    {
        return HttpStatus::METHOD_NOT_ALLOWED;
    }
}
