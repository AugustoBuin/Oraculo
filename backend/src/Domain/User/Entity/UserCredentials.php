<?php

declare(strict_types=1);

namespace App\Domain\User\Entity;

/**
 * Um usuário junto do hash da senha dele.
 *
 * Existe para que o hash tenha **um único caminho** dentro da aplicação: do
 * repositório até o caso de uso de autenticação, e nada além. A entidade User,
 * que circula por rotas, apresentadores e logs, nunca o carrega.
 *
 * Se este objeto começar a aparecer em outros lugares, é sinal de que a regra
 * se perdeu.
 */
final class UserCredentials
{
    public function __construct(
        public readonly User $user,
        public readonly string $passwordHash,
    ) {
    }

    /**
     * Confere a senha em tempo constante — `password_verify` já faz isso.
     */
    public function matches(string $plainPassword): bool
    {
        return password_verify($plainPassword, $this->passwordHash);
    }
}
