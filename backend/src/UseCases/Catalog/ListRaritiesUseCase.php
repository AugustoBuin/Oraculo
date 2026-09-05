<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

use App\Domain\Catalog\Entity\Rarity;
use App\Domain\Catalog\Gateway\GameGateway;
use App\Domain\Catalog\Gateway\RarityGateway;
use App\Domain\Errors\NotFoundError;

/**
 * As raridades de um jogo.
 *
 * O enunciado não pede este endpoint: ele pede a cascata só para a edição. Ele
 * existe porque raridade também é específica de cada TCG, e um campo livre
 * permitiria cadastrar carta de Magic como "Secret Rare" (docs/PRD.md, seção 6,
 * decisão 1). Reaproveita exatamente o mecanismo já construído para as edições.
 */
final class ListRaritiesUseCase
{
    private function __construct(
        private readonly GameGateway $games,
        private readonly RarityGateway $rarities,
    ) {
    }

    public static function create(GameGateway $games, RarityGateway $rarities): self
    {
        return new self($games, $rarities);
    }

    /** @return list<Rarity> */
    public function execute(string $gameSlug): array
    {
        $game = $this->games->findBySlug($gameSlug);

        if ($game === null || !$game->active) {
            throw new NotFoundError('Card game não encontrado.');
        }

        return $this->rarities->listActiveByGame($game->id);
    }
}
