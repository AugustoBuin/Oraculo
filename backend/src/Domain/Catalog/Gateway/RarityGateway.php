<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Gateway;

use App\Domain\Catalog\Entity\Rarity;

interface RarityGateway
{
    /** @return list<Rarity> ativas do jogo, na ordem natural do jogo */
    public function listActiveByGame(int $gameId): array;

    /** Ver a nota em EditionGateway: o jogo entra na busca, não depois dela. */
    public function findByGameAndCode(int $gameId, string $code): ?Rarity;

    public function findById(int $id): ?Rarity;
}
