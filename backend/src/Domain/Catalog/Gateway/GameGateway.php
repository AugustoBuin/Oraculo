<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Gateway;

use App\Domain\Catalog\Entity\Game;

interface GameGateway
{
    /** @return list<Game> ativos, na ordem de exibição */
    public function listActive(): array;

    public function findBySlug(string $slug): ?Game;

    public function findById(int $id): ?Game;
}
