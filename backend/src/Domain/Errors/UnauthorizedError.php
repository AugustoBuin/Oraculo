<?php

declare(strict_types=1);

namespace App\Domain\Errors;

use App\Shared\Enum\HttpStatus;

/**
 * Não há sessão, ou a sessão expirou.

 * 401 e não 403: o frontend precisa distinguir "leve ao login" de "você não
 * tem permissão para isto", e decidir isso pelo texto da mensagem seria
 * acoplamento frágil. Isto corrige a tabela do PADROES.md §4.2 e está
 * registrado em docs/decisions/ADR-007.
 */
final class UnauthorizedError extends DomainError
{
    public function status(): HttpStatus
    {
        return HttpStatus::UNAUTHORIZED;
    }
}
