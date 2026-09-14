<?php

declare(strict_types=1);

namespace Tests\Doubles;

use App\Domain\Catalog\Entity\Game;
use App\Domain\Catalog\Gateway\GameGateway;

final class InMemoryGameGateway implements GameGateway
{
    /** @var list<Game> */
    public array $games = [];

    public static function seeded(): self
    {
        $gateway = new self();
        $gateway->games = [
            Game::with(1, 'magic', 'Magic: The Gathering', true, 1),
            Game::with(2, 'pokemon', 'Pokémon', true, 2),
            // Desativado: precisa sumir das listagens sem sumir do banco.
            Game::with(9, 'lorcana', 'Disney Lorcana', false, 9),
        ];

        return $gateway;
    }

    public function listActive(): array
    {
        $active = array_values(array_filter($this->games, static fn(Game $g): bool => $g->active));
        usort($active, static fn(Game $a, Game $b): int => $a->sortOrder <=> $b->sortOrder);

        return $active;
    }

    public function findBySlug(string $slug): ?Game
    {
        foreach ($this->games as $game) {
            if ($game->slug === $slug) {
                return $game;
            }
        }

        return null;
    }

    public function findById(int $id): ?Game
    {
        foreach ($this->games as $game) {
            if ($game->id === $id) {
                return $game;
            }
        }

        return null;
    }
}
