<?php

declare(strict_types=1);

namespace App\Domain\Card\Entity;

use App\Shared\Enum\CardAction;

/**
 * Uma linha do histórico de uma carta.
 *
 * `changes` guarda apenas o que mudou, com valores **apresentáveis** — nomes,
 * não ids. É o que se quer ler seis meses depois: "Raridade: Rara → Mítica", e
 * não "rarity_id: 32 → 31". Guardar a linha inteira torna ilegível justamente a
 * informação que motivou guardar o histórico.
 */
final class CardAuditEntry
{
    /** @param array<string,array{from: string|null, to: string|null}> $changes */
    private function __construct(
        public readonly CardAction $action,
        public readonly int $userId,
        public readonly ?string $userName,
        public readonly array $changes,
        public readonly \DateTimeImmutable $createdAt,
    ) {
    }

    /** @param array<string,array{from: string|null, to: string|null}> $changes */
    public static function with(
        CardAction $action,
        int $userId,
        ?string $userName,
        array $changes,
        \DateTimeImmutable $createdAt,
    ): self {
        return new self($action, $userId, $userName, $changes, $createdAt);
    }
}
