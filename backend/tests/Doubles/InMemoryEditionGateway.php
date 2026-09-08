<?php

declare(strict_types=1);

namespace Tests\Doubles;

use App\Domain\Catalog\Entity\Edition;
use App\Domain\Catalog\Gateway\EditionGateway;

final class InMemoryEditionGateway implements EditionGateway
{
    /** @var list<Edition> */
    public array $editions = [];

    public static function seeded(): self
    {
        $gateway = new self();
        $gateway->editions = [
            Edition::with(10, 1, 'dom', 'Dominaria', true, 1),
            Edition::with(11, 1, 'war', 'War of the Spark', true, 2),
            Edition::with(12, 1, 'antiga', 'Edição Desativada', false, 3),
            Edition::with(20, 2, 'base1', 'Base Set', true, 1),
            // Mesmo código em jogo diferente: único é o par (jogo, código).
            Edition::with(21, 2, 'dom', 'Homônima de Outro Jogo', true, 2),
        ];

        return $gateway;
    }

    public function listActiveByGame(int $gameId): array
    {
        $found = array_values(array_filter(
            $this->editions,
            static fn(Edition $e): bool => $e->gameId === $gameId && $e->active
        ));
        usort($found, static fn(Edition $a, Edition $b): int => $a->sortOrder <=> $b->sortOrder);

        return $found;
    }

    public function listAllByGame(int $gameId): array
    {
        $found = array_values(array_filter(
            $this->editions,
            static fn(Edition $item): bool => $item->gameId === $gameId
        ));
        usort($found, static fn(Edition $a, Edition $b): int => $a->sortOrder <=> $b->sortOrder);

        return $found;
    }

    public function findByGameAndCode(int $gameId, string $code): ?Edition
    {
        foreach ($this->editions as $edition) {
            if ($edition->gameId === $gameId && $edition->code === $code) {
                return $edition;
            }
        }

        return null;
    }

    public function findById(int $id): ?Edition
    {
        foreach ($this->editions as $edition) {
            if ($edition->id === $id) {
                return $edition;
            }
        }

        return null;
    }
}
