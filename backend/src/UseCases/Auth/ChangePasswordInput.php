<?php

declare(strict_types=1);

namespace App\UseCases\Auth;

/**
 * Entrada da troca de senha.
 *
 * `userId` vem da SESSÃO, nunca do corpo da requisição. Aceitá-lo do cliente
 * transformaria esta rota em "troque a senha de quem eu quiser" — a falha de
 * controle de acesso mais direta que existe (PADROES.md §5.3).
 */
final class ChangePasswordInput
{
    public function __construct(
        public readonly int $userId,
        public readonly string $currentPassword,
        public readonly string $newPassword,
    ) {
    }
}
