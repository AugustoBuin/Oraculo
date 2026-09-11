<?php

declare(strict_types=1);

namespace Tests\Doubles;

use App\Domain\Catalog\Entity\Rarity;
use App\Domain\Catalog\Gateway\RarityGateway;
use App\Shared\Enum\RarityColor;

final class InMemoryRarityGateway implements RarityGateway
{
    /** @var list<Rarity> */
    public array $rarities = [];

    /** @var list<int> ids de raridade usados por alguma carta */
    public array $inUse = [];

    private int $nextId = 100;

    public static function seeded(): self
    {
        $gateway = new self();
        $gateway->rarities = [
            // Declaradas fora de ordem de propósito: raridade tem ordem
            // natural, e o teste precisa provar que ela é respeitada.
            Rarity::with(31, 1, 'mythic', 'Mítica', true, 4, RarityColor::COPPER),
            Rarity::with(30, 1, 'common', 'Comum', true, 1),
            Rarity::with(32, 1, 'rare', 'Rara', true, 3, RarityColor::GOLD),
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

    // --- Escrita ----------------------------------------------------------------

    public function label(): string
    {
        return 'raridade';
    }

    public function insert(int $gameId, string $code, string $name, int $sortOrder, RarityColor $color): int
    {
        $id = $this->nextId++;
        $this->rarities[] = Rarity::with($id, $gameId, $code, $name, true, $sortOrder, $color);

        return $id;
    }

    public function updateDetails(int $id, string $name, int $sortOrder, bool $active, RarityColor $color): void
    {
        $this->replace($id, static fn(Rarity $r): Rarity => Rarity::with($r->id, $r->gameId, $r->code, $name, $active, $sortOrder, $color));
    }

    public function deactivate(int $id): void
    {
        $this->replace($id, static fn(Rarity $r): Rarity => Rarity::with($r->id, $r->gameId, $r->code, $r->name, false, $r->sortOrder, $r->color));
    }

    public function existsWithCode(int $gameId, string $code, ?int $excludingId): bool
    {
        foreach ($this->rarities as $rarity) {
            if ($rarity->gameId === $gameId && $rarity->code === $code && $rarity->id !== $excludingId) {
                return true;
            }
        }

        return false;
    }

    public function gameIdOf(int $id): ?int
    {
        return $this->findById($id)?->gameId;
    }

    public function isInUse(int $id): bool
    {
        return in_array($id, $this->inUse, true);
    }

    /** A entidade é imutável: alterar é trocar o registro inteiro. */
    private function replace(int $id, callable $change): void
    {
        foreach ($this->rarities as $i => $rarity) {
            if ($rarity->id === $id) {
                $this->rarities[$i] = $change($rarity);
            }
        }
    }
}
