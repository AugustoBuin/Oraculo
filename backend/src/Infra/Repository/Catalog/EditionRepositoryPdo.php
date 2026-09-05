<?php

declare(strict_types=1);

namespace App\Infra\Repository\Catalog;

use App\Domain\Catalog\Entity\Edition;
use App\Domain\Catalog\Gateway\EditionGateway;

final class EditionRepositoryPdo implements EditionGateway
{
    private const COLUMNS = 'id, game_id, code, name, active, sort_order';

    public function __construct(
        private readonly \PDO $pdo,
    ) {
    }

    public function listActiveByGame(int $gameId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . '
             FROM editions
             WHERE game_id = :game_id AND active = 1 AND deleted_at IS NULL
             ORDER BY sort_order ASC, name ASC'
        );
        $statement->execute(['game_id' => $gameId]);

        return array_map($this->toEntity(...), $statement->fetchAll());
    }

    public function findByGameAndCode(int $gameId, string $code): ?Edition
    {
        // O jogo entra na cláusula, não em uma checagem posterior: procurar só
        // pelo código encontraria a edição de outro jogo que use a mesma sigla,
        // e a validação de "pertence ao jogo" passaria por acidente.
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . '
             FROM editions
             WHERE game_id = :game_id AND code = :code AND deleted_at IS NULL
             LIMIT 1'
        );
        $statement->execute(['game_id' => $gameId, 'code' => $code]);

        $row = $statement->fetch();

        return $row === false ? null : $this->toEntity($row);
    }

    public function findById(int $id): ?Edition
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM editions WHERE id = :id AND deleted_at IS NULL LIMIT 1'
        );
        $statement->execute(['id' => $id]);

        $row = $statement->fetch();

        return $row === false ? null : $this->toEntity($row);
    }

    /** @param array<string,mixed> $row */
    private function toEntity(array $row): Edition
    {
        return Edition::with(
            id: (int) $row['id'],
            gameId: (int) $row['game_id'],
            code: (string) $row['code'],
            name: (string) $row['name'],
            active: (bool) $row['active'],
            sortOrder: (int) $row['sort_order'],
        );
    }
}
