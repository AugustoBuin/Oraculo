<?php

declare(strict_types=1);

namespace App\Infra\Repository\Catalog;

use App\Domain\Catalog\Entity\Game;
use App\Domain\Catalog\Gateway\GameGateway;

final class GameRepositoryPdo implements GameGateway
{
    private const COLUMNS = 'id, slug, name, active, sort_order';

    public function __construct(
        private readonly \PDO $pdo,
    ) {
    }

    public function listActive(): array
    {
        // Sem LIMIT explícito porque a cláusula WHERE já delimita o conjunto a
        // uma dezena de linhas por natureza do domínio — são card games, não
        // registros de usuário. O §7.3 exige WHERE **ou** paginação.
        $statement = $this->pdo->query(
            'SELECT ' . self::COLUMNS . '
             FROM games
             WHERE active = 1 AND deleted_at IS NULL
             ORDER BY sort_order ASC, name ASC'
        );

        return array_map($this->toEntity(...), $statement === false ? [] : $statement->fetchAll());
    }

    public function findBySlug(string $slug): ?Game
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM games WHERE slug = :slug AND deleted_at IS NULL LIMIT 1'
        );
        $statement->execute(['slug' => $slug]);

        $row = $statement->fetch();

        return $row === false ? null : $this->toEntity($row);
    }

    public function findById(int $id): ?Game
    {
        $statement = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM games WHERE id = :id AND deleted_at IS NULL LIMIT 1'
        );
        $statement->execute(['id' => $id]);

        $row = $statement->fetch();

        return $row === false ? null : $this->toEntity($row);
    }

    /** @param array<string,mixed> $row */
    private function toEntity(array $row): Game
    {
        return Game::with(
            id: (int) $row['id'],
            slug: (string) $row['slug'],
            name: (string) $row['name'],
            active: (bool) $row['active'],
            sortOrder: (int) $row['sort_order'],
        );
    }
}
