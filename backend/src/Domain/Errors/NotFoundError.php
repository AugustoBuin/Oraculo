<?php

declare(strict_types=1);

namespace App\Domain\Errors;

use App\Shared\Enum\HttpStatus;

/**
 * A entidade não existe — ou o solicitante não pode vê-la.

 * Os dois casos respondem igual de propósito (PADROES.md §5.2).
 */
final class NotFoundError extends DomainError
{
    public function status(): HttpStatus
    {
        return HttpStatus::NOT_FOUND;
    }
}
