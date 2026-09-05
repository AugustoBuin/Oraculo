<?php

declare(strict_types=1);

namespace App\Domain\Errors;

use App\Shared\Enum\HttpStatus;

/**
 * Limite de tentativas excedido na janela deslizante.

 * Não descrito no PADROES.md §4.2, que não previa rate limit; acrescentado
 * aqui e registrado em docs/api-contract.md §2.
 */
final class TooManyRequestsError extends DomainError
{
    public function status(): HttpStatus
    {
        return HttpStatus::TOO_MANY_REQUESTS;
    }
}
