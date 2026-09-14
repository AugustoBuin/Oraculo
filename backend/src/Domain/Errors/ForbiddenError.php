<?php

declare(strict_types=1);

namespace App\Domain\Errors;

use App\Shared\Enum\HttpStatus;

/**
 * Sessão válida, mas o nível de permissão não alcança a operação.

 * Também é o status de token CSRF ausente ou divergente: a sessão pode estar
 * perfeitamente válida, e tratar como 401 deslogaria o usuário por um problema
 * que se resolve rebuscando o token.

 * Atenção: recurso que EXISTE mas que o solicitante não pode ver responde 404,
 * não 403 — devolver 403 ali confirma a existência do registro e transforma a
 * resposta num oráculo (PADROES.md §5.2).
 */
final class ForbiddenError extends DomainError
{
    public function status(): HttpStatus
    {
        return HttpStatus::FORBIDDEN;
    }
}
