<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

/**
 * Entrada de criação e de edição de item de catálogo.
 *
 * `code` só é usado na criação: ele é o identificador PÚBLICO do item, e
 * identificador público não muda. Trocá-lo quebraria todo link e todo filtro
 * salvo que apontasse para ele.
 */
final class SaveCatalogItemInput
{
    public function __construct(
        public readonly string $gameSlug,
        public readonly string $name,
        public readonly ?string $code = null,
        public readonly int $sortOrder = 0,
        public readonly bool $active = true,
        public readonly ?int $itemId = null,
    ) {
    }
}
