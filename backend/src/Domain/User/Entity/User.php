<?php

declare(strict_types=1);

namespace App\Domain\User\Entity;

use App\Shared\Enum\PermissionLevel;

/**
 * Um usuário do portal.
 *
 * Imutável, e **sem o hash da senha**. A verificação de credencial acontece no
 * repositório, que é quem lê a coluna; a entidade que circula pela aplicação
 * nunca carrega o hash, então ele não pode vazar por um `var_dump`, por um log
 * de contexto ou por um apresentador distraído.
 */
final class User
{
    private function __construct(
        public readonly int $id,
        public readonly string $name,
        public readonly string $email,
        public readonly PermissionLevel $level,
        public readonly bool $active,
    ) {
    }

    /**
     * Reconstrói um usuário já existente — usado pelo repositório ao mapear a
     * linha do banco para o domínio.
     */
    public static function with(
        int $id,
        string $name,
        string $email,
        PermissionLevel $level,
        bool $active,
    ): self {
        return new self($id, $name, $email, $level, $active);
    }

    public function can(PermissionLevel $required): bool
    {
        return $this->active && $this->level->allows($required);
    }
}
