<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Entity;

/**
 * Uma edição, pertencente a exatamente um jogo.
 *
 * O `code` é o identificador do JSON do enunciado — "dom", "war", "base1" — e é
 * exposto na API como `id`, para bater com o contrato que o desafio publicou.
 *
 * Estruturalmente idêntica a Rarity hoje, e mantida separada de propósito: são
 * conceitos diferentes que vão divergir (edição ganha data de lançamento,
 * raridade ganha cor e ícone). Unificá-las agora criaria uma abstração que o
 * domínio ainda não pediu.
 */
final class Edition
{
    private function __construct(
        public readonly int $id,
        public readonly int $gameId,
        public readonly string $code,
        public readonly string $name,
        public readonly bool $active,
        public readonly int $sortOrder,
    ) {
    }

    public static function with(
        int $id,
        int $gameId,
        string $code,
        string $name,
        bool $active,
        int $sortOrder,
    ): self {
        return new self($id, $gameId, $code, $name, $active, $sortOrder);
    }

    public function belongsTo(Game $game): bool
    {
        return $this->gameId === $game->id;
    }
}
