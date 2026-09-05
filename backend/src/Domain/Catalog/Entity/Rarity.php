<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Entity;

/**
 * Uma raridade, pertencente a exatamente um jogo.
 *
 * Esta entidade é a Decisão de UX nº 1 materializada. O enunciado pede só
 * "Raridade da Carta", sem especificar o campo; um texto livre permitiria
 * cadastrar carta de Magic como "Secret Rare" — raridade que só existe em
 * Yu-Gi-Oh!. Amarrar a raridade ao jogo impede o erro em vez de corrigi-lo
 * depois, e dado sujo em catálogo não é notado no cadastro: é notado meses
 * adiante, quando um relatório não bate.
 *
 * `sortOrder` existe porque raridade tem ordem natural — comum, incomum, rara,
 * mítica — que não é a alfabética.
 */
final class Rarity
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
