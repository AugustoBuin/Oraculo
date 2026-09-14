<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

/**
 * Entrada de criação de raridade.
 *
 * `color` chega cru, como o cliente mandou, e é o caso de uso que decide se
 * ele está na paleta. Ausente (`null`) quer dizer "sem escolha": a raridade
 * nasce grafite, o selo neutro.
 */
final class CreateRarityInput
{
    public function __construct(
        public readonly string $gameSlug,
        public readonly string $code,
        public readonly string $name,
        public readonly int $sortOrder = 0,
        public readonly ?string $color = null,
    ) {
    }
}
