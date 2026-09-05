<?php

declare(strict_types=1);

namespace App\Domain\Card\Event;

use App\Shared\Event\DomainEvent;
use App\Shared\Enum\CardAction;

/**
 * Uma carta mudou de estado.
 *
 * Um evento com o tipo da ação, e não quatro classes quase idênticas: os quatro
 * casos — criada, alterada, excluída, restaurada — têm exatamente a mesma carga
 * e o mesmo único ouvinte. Quatro classes seriam cerimônia sem nada eliminado,
 * que é o que o §1.3 chama de decoração.
 *
 * Se algum dia um dos casos precisar de carga própria — "excluída" com o motivo,
 * por exemplo —, aí sim ele vira classe separada.
 */
final class CardChanged implements DomainEvent
{
    /** @param array<string,array{from: string|null, to: string|null}> $changes */
    public function __construct(
        public readonly int $cardId,
        public readonly int $userId,
        public readonly CardAction $action,
        public readonly array $changes = [],
    ) {
    }
}
