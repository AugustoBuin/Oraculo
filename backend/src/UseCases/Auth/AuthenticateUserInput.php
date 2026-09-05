<?php

declare(strict_types=1);

namespace App\UseCases\Auth;

/**
 * Entrada da autenticação.
 *
 * DTO explícito, montado campo a campo pela rota. É o que impede o corpo da
 * requisição de chegar inteiro até aqui — a porta de entrada do mass assignment
 * (PADROES.md §5.3).
 */
final class AuthenticateUserInput
{
    public function __construct(
        public readonly string $email,
        public readonly string $password,
        public readonly ?string $ipAddress,
        public readonly ?string $userAgent,
    ) {
    }
}
