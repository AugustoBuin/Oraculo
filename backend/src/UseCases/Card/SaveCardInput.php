<?php

declare(strict_types=1);

namespace App\UseCases\Card;

use App\Domain\Card\Validation\CardDraft;

/**
 * Entrada de criação e de edição de carta.
 *
 * `authorId` vem da SESSÃO, nunca do corpo. `cardId` é nulo na criação — é o
 * que distingue as duas operações sem um sinalizador à parte.
 *
 * O rascunho já chega montado campo a campo pela rota: o corpo da requisição
 * não atravessa esta fronteira (PADROES.md §5.3).
 */
final class SaveCardInput
{
    public function __construct(
        public readonly CardDraft $draft,
        public readonly int $authorId,
        public readonly bool $confirmDuplicate = false,
        public readonly ?int $cardId = null,
    ) {
    }
}
