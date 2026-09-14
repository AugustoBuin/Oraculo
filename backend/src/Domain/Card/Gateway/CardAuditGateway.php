<?php

declare(strict_types=1);

namespace App\Domain\Card\Gateway;

use App\Domain\Card\Entity\CardAuditEntry;
use App\Shared\Enum\CardAction;

interface CardAuditGateway
{
    /**
     * @param array<string,array{from: string|null, to: string|null}> $changes
     */
    public function record(
        int $cardId,
        int $userId,
        CardAction $action,
        array $changes,
        ?string $traceId,
        \DateTimeImmutable $at,
    ): void;

    /**
     * O histórico de uma carta, do mais recente para o mais antigo.
     *
     * Paginado por limite: um histórico longo não pode virar uma resposta de
     * megabytes nem uma leitura sem teto (PADROES.md §7.3).
     *
     * @return list<CardAuditEntry>
     */
    public function listForCard(int $cardId, int $limit): array;
}
