<?php

declare(strict_types=1);

namespace App\Infra\Http\Presenter;

use App\Domain\User\Entity\User;

/**
 * A forma pública de um usuário.
 *
 * Existe em um lugar só para que a resposta não divirja entre rotas — e para
 * que acrescentar um campo sensível exija passar por aqui, onde a decisão fica
 * visível na revisão.
 *
 * O hash da senha não aparece porque a entidade User nem o carrega: a proteção
 * é estrutural, não uma lembrança de quem escreveu este arquivo.
 */
final class UserPresenter
{
    /** @return array<string,mixed> */
    public static function toArray(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->level->name,
            'roleLabel' => $user->level->label(),
            'level' => $user->level->value,
        ];
    }
}
