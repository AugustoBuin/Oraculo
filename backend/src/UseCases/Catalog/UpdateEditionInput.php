<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

/**
 * Entrada de alteração de edição.
 *
 * Não tem `code` de propósito: o código é o identificador público, aparece na
 * URL e em qualquer filtro salvo, e identificador público não muda.
 */
final class UpdateEditionInput
{
    public function __construct(
        public readonly int $editionId,
        public readonly string $name,
        public readonly int $sortOrder,
        public readonly bool $active,
    ) {
    }
}
