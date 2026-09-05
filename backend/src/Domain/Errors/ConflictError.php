<?php

declare(strict_types=1);

namespace App\Domain\Errors;

use App\Shared\Enum\HttpStatus;

/**
 * Violação de unicidade ou de estado.

 * Ex.: restaurar uma carta que não está excluída, ou desativar um item de
 * catálogo que ainda está em uso.
 */
final class ConflictError extends DomainError
{
    public function status(): HttpStatus
    {
        return HttpStatus::CONFLICT;
    }
}
