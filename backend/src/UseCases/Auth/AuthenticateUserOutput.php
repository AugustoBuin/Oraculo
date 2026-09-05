<?php

declare(strict_types=1);

namespace App\UseCases\Auth;

use App\Domain\Session\Entity\Session;
use App\Domain\User\Entity\User;

/**
 * Saída da autenticação.
 *
 * Carrega a entidade User — que, por construção, não tem o hash da senha — e a
 * sessão recém-aberta, de onde a rota tira o cookie e o token anti-CSRF.
 */
final class AuthenticateUserOutput
{
    public function __construct(
        public readonly User $user,
        public readonly Session $session,
    ) {
    }
}
