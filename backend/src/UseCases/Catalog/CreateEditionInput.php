<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

/** Entrada de criação de edição: só os campos que a criação usa. */
final class CreateEditionInput
{
    public function __construct(
        public readonly string $gameSlug,
        public readonly string $code,
        public readonly string $name,
        public readonly int $sortOrder = 0,
    ) {
    }
}
