<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

use App\Domain\Catalog\Entity\Game;
use App\Domain\Catalog\Gateway\GameGateway;

/**
 * Os jogos disponíveis para cadastro.
 *
 * Primeiro degrau da cascata: é a lista que popula o `<select>` de Card Game, e
 * de cuja escolha dependem a edição e a raridade.
 */
final class ListGamesUseCase
{
    private function __construct(
        private readonly GameGateway $games,
    ) {
    }

    public static function create(GameGateway $games): self
    {
        return new self($games);
    }

    /** @return list<Game> */
    public function execute(): array
    {
        return $this->games->listActive();
    }
}
