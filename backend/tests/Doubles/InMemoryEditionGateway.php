<?php

declare(strict_types=1);

namespace Tests\Doubles;

use App\Domain\Catalog\Entity\Edition;
use App\Domain\Catalog\Gateway\EditionGateway;

final class InMemoryEditionGateway implements EditionGateway
{
    /** @var list<Edition> */
    public array $editions = [];

    /** @var list<int> ids de edição usados por alguma carta */
    public array $inUse = [];

    private int $nextId = 100;

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

    // --- Escrita (CatalogItemGateway) -----------------------------------------

    public function label(): string
    {
        return 'edição';
    }

    public function insert(int $gameId, string $code, string $name, int $sortOrder): int
    {
        $id = $this->nextId++;
        $this->editions[] = Edition::with($id, $gameId, $code, $name, true, $sortOrder);

        return $id;
    }

    public function updateDetails(int $id, string $name, int $sortOrder, bool $active): void
    {
        $this->replace($id, static fn(Edition $e): Edition => Edition::with($e->id, $e->gameId, $e->code, $name, $active, $sortOrder));
    }

    public function deactivate(int $id): void
    {
        $this->replace($id, static fn(Edition $e): Edition => Edition::with($e->id, $e->gameId, $e->code, $e->name, false, $e->sortOrder));
    }

    public function existsWithCode(int $gameId, string $code, ?int $excludingId): bool
    {
        foreach ($this->editions as $edition) {
            if ($edition->gameId === $gameId && $edition->code === $code && $edition->id !== $excludingId) {
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
        foreach ($this->editions as $i => $edition) {
            if ($edition->id === $id) {
                $this->editions[$i] = $change($edition);
            }
        }
    }
}
