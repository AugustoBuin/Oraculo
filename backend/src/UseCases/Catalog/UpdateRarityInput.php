<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

/**
 * Entrada de alteração de raridade.
 *
 * Sem `code`: identificador público não muda. E `color` é obrigatória — o `PUT`
 * é substituição, e `null` aqui é recusado em vez de virar grafite em silêncio
 * por cima da cor que havia.
 */
final class UpdateRarityInput
{
    public function __construct(
        public readonly int $rarityId,
        public readonly string $name,
        public readonly int $sortOrder,
        public readonly bool $active,
        public readonly ?string $color,
    ) {
    }
}
