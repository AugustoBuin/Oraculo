<?php

declare(strict_types=1);

namespace App\UseCases\Card;

/**
 * Filtros de listagem, como vieram da query string.
 *
 * Tudo é texto ou nulo porque é assim que chega de uma URL. A normalização —
 * página mínima, teto de itens por página, allowlist de ordenação — acontece em
 * CardQuery, num lugar só.
 */
final class ListCardsInput
{
    public function __construct(
        public readonly ?string $page = null,
        public readonly ?string $perPage = null,
        public readonly ?string $search = null,
        public readonly ?string $gameSlug = null,
        public readonly ?string $editionCode = null,
        public readonly ?string $rarityCode = null,
        public readonly ?string $sort = null,
    ) {
    }
}
