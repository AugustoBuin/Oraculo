<?php

declare(strict_types=1);

namespace Tests\Doubles;

use App\Domain\Catalog\Entity\Rarity;
use App\Domain\Catalog\Gateway\RarityGateway;

final class InMemoryRarityGateway implements RarityGateway
{
    /** @var list<Rarity> */
    public array $rarities = [];

    public static function seeded(): self
    {
        $gateway = new self();
        $gateway->rarities = [
            // Declaradas fora de ordem de propósito: raridade tem ordem
            // natural, e o teste precisa provar que ela é respeitada.
            Rarity::with(31, 1, 'mythic', 'Mítica', true, 4),
            Rarity::with(30, 1, 'common', 'Comum', true, 1),
            Rarity::with(32, 1, 'rare', 'Rara', true, 3),
            Rarity::with(33, 1, 'aposentada', 'Raridade Aposentada', false, 5),
            Rarity::with(40, 2, 'rare-holo', 'Rara Holo', true, 4),
        ];

        return $gateway;
    }

    public function listActiveByGame(int $gameId): array
    {
        $found = array_values(array_filter(
            $this->rarities,
            static fn(Rarity $r): bool => $r->gameId === $gameId && $r->active
        ));
        usort($found, static fn(Rarity $a, Rarity $b): int => $a->sortOrder <=> $b->sortOrder);

        return $found;
    }

    public function listAllByGame(int $gameId): array
    {
        $found = array_values(array_filter(
            $this->rarities,
            static fn(Rarity $item): bool => $item->gameId === $gameId
        ));
        usort($found, static fn(Rarity $a, Rarity $b): int => $a->sortOrder <=> $b->sortOrder);

        return $found;
    }

    public function findByGameAndCode(int $gameId, string $code): ?Rarity
    {
        foreach ($this->rarities as $rarity) {
            if ($rarity->gameId === $gameId && $rarity->code === $code) {
                return $rarity;
            }
        }

        return null;
    }

    public function findById(int $id): ?Rarity
    {
        foreach ($this->rarities as $rarity) {
            if ($rarity->id === $id) {
                return $rarity;
            }
        }

        return null;
    }
}
