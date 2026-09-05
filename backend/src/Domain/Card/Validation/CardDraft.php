<?php

declare(strict_types=1);

namespace App\Domain\Card\Validation;

/**
 * O que o cliente mandou, ainda não validado.
 *
 * Só identificadores públicos — slug do jogo, código da edição e da raridade —
 * e nunca ids numéricos. Resolver o identificador público para a entidade é
 * justamente o trabalho da cadeia, e é o que torna impossível referenciar um
 * registro que não passou pela validação.
 */
final class CardDraft
{
    /** @param array<string,mixed>|null $image */
    public function __construct(
        public readonly string $nameEn,
        public readonly ?string $namePt,
        public readonly string $gameSlug,
        public readonly string $editionCode,
        public readonly string $rarityCode,
        public readonly ?array $image,
    ) {
    }
}
