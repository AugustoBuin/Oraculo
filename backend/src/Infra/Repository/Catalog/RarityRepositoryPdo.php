<?php

declare(strict_types=1);

namespace App\Infra\Repository\Catalog;

use App\Domain\Catalog\Entity\Rarity;
use App\Domain\Catalog\Gateway\CatalogItemGateway;
use App\Domain\Catalog\Gateway\RarityGateway;

final class RarityRepositoryPdo implements RarityGateway, CatalogItemGateway
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

    /**
     * Inclui as desativadas. `deleted_at` continua fora: desativado é estado
     * reversível, excluído não é — e a administração de catálogos existe para
     * o primeiro caso, não para desfazer o segundo.
     */
    public function listAllByGame(int $gameId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . '
             FROM rarities
             WHERE game_id = :game_id AND deleted_at IS NULL
             ORDER BY sort_order ASC, name ASC'
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

    // --- Escrita (CatalogItemGateway) -----------------------------------------

    public function label(): string
    {
        return 'raridade';
    }

    public function insert(int $gameId, string $code, string $name, int $sortOrder): int
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO rarities (game_id, code, name, sort_order, active, created_at)
             VALUES (:game_id, :code, :name, :sort_order, 1, :created_at)'
        );

        $statement->execute([
            'game_id' => $gameId,
            'code' => $code,
            'name' => $name,
            'sort_order' => $sortOrder,
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    public function updateDetails(int $id, string $name, int $sortOrder, bool $active): void
    {
        // `code` é imutável: identificador público não muda.
        // `sort_order` importa mais aqui do que em edições — é ele que mantém
        // comum, incomum, rara e mítica na ordem natural do jogo.
        $statement = $this->pdo->prepare(
            'UPDATE rarities SET name = :name, sort_order = :sort_order, active = :active, updated_at = :updated_at
             WHERE id = :id'
        );

        $statement->execute([
            'name' => $name,
            'sort_order' => $sortOrder,
            'active' => $active ? 1 : 0,
            'updated_at' => date('Y-m-d H:i:s'),
            'id' => $id,
        ]);
    }

    public function deactivate(int $id): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE rarities SET active = 0, updated_at = :updated_at WHERE id = :id'
        );
        $statement->execute(['updated_at' => date('Y-m-d H:i:s'), 'id' => $id]);
    }

    public function existsWithCode(int $gameId, string $code, ?int $excludingId): bool
    {
        $sql = 'SELECT 1 FROM rarities WHERE game_id = :game_id AND code = :code AND deleted_at IS NULL';
        $params = ['game_id' => $gameId, 'code' => $code];

        if ($excludingId !== null) {
            $sql .= ' AND id <> :excluding';
            $params['excluding'] = $excludingId;
        }

        $statement = $this->pdo->prepare($sql . ' LIMIT 1');
        $statement->execute($params);

        return $statement->fetchColumn() !== false;
    }

    public function gameIdOf(int $id): ?int
    {
        $statement = $this->pdo->prepare(
            'SELECT game_id FROM rarities WHERE id = :id AND deleted_at IS NULL LIMIT 1'
        );
        $statement->execute(['id' => $id]);

        $gameId = $statement->fetchColumn();

        return $gameId === false ? null : (int) $gameId;
    }

    public function isInUse(int $id): bool
    {
        $statement = $this->pdo->prepare(
            'SELECT 1 FROM cards WHERE rarity_id = :id AND deleted_at IS NULL LIMIT 1'
        );
        $statement->execute(['id' => $id]);

        return $statement->fetchColumn() !== false;
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
