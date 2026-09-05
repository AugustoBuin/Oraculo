<?php

declare(strict_types=1);

namespace App\Infra\Repository\Catalog;

use App\Domain\Catalog\Entity\Rarity;
use App\Domain\Catalog\Gateway\RarityGateway;

final class RarityRepositoryPdo implements RarityGateway
{
    private const COLUMNS = 'id, game_id, code, name, active, sort_order';

    public function __construct(
        private readonly \PDO $pdo,
    ) {
    }

    public function listActiveByGame(int $gameId): array
    {
        // ORDER BY sort_order e não por nome: raridade tem ordem natural —
        // comum, incomum, rara, mítica — que não é a alfabética.
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . '
             FROM rarities
             WHERE game_id = :game_id AND active = 1 AND deleted_at IS NULL
             ORDER BY sort_order ASC'
        );
        $statement->execute(['game_id' => $gameId]);

        return array_map($this->toEntity(...), $statement->fetchAll());
    }

    public function findByGameAndCode(int $gameId, string $code): ?Rarity
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . '
             FROM rarities
             WHERE game_id = :game_id AND code = :code AND deleted_at IS NULL
             LIMIT 1'
        );
        $statement->execute(['game_id' => $gameId, 'code' => $code]);

        $row = $statement->fetch();

        return $row === false ? null : $this->toEntity($row);
    }

    public function findById(int $id): ?Rarity
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM rarities WHERE id = :id AND deleted_at IS NULL LIMIT 1'
        );
        $statement->execute(['id' => $id]);

        $row = $statement->fetch();

        return $row === false ? null : $this->toEntity($row);
    }

    /** @param array<string,mixed> $row */
    private function toEntity(array $row): Rarity
    {
        return Rarity::with(
            id: (int) $row['id'],
            gameId: (int) $row['game_id'],
            code: (string) $row['code'],
            name: (string) $row['name'],
            active: (bool) $row['active'],
            sortOrder: (int) $row['sort_order'],
        );
    }
}
