<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Entity;

/**
 * Um card game.
 *
 * É o discriminador de tenant do produto: a razão de existir uma tabela em vez
 * de um ENUM na coluna de cards. Com a tabela, abrir o portal de um TCG novo é
 * um INSERT; com o ENUM, seria ALTER TABLE e deploy (docs/PRD.md, seção 1.1).
 *
 * O `slug` é o identificador PÚBLICO — "magic", "pokemon" — e é imutável.
 * A API nunca expõe o id numérico: id de catálogo é detalhe de armazenamento, e
 * expô-lo amarra o contrato à ordem de inserção do seed.
 */
final class Game
{
    private function __construct(
        public readonly int $id,
        public readonly string $slug,
        public readonly string $name,
        public readonly bool $active,
        public readonly int $sortOrder,
    ) {
    }

    public static function with(int $id, string $slug, string $name, bool $active, int $sortOrder): self
    {
        return new self($id, $slug, $name, $active, $sortOrder);
    }
}
