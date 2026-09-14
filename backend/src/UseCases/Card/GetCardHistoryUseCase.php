<?php

declare(strict_types=1);

namespace App\UseCases\Card;

use App\Domain\Card\Entity\CardAuditEntry;
use App\Domain\Card\Gateway\CardAuditGateway;
use App\Domain\Card\Gateway\CardGateway;
use App\Domain\Errors\NotFoundError;

/**
 * O histórico de alterações de uma carta.
 *
 * Usa `findByIdIncludingDeleted` de propósito: o histórico de uma carta
 * excluída é justamente o que alguém vai querer consultar para descobrir quem a
 * excluiu — e responder 404 ali esconderia a informação no momento em que ela
 * mais importa.
 */
final class GetCardHistoryUseCase
{
    private const MAX_ENTRIES = 100;

    private function __construct(
        private readonly CardGateway $cards,
        private readonly CardAuditGateway $audit,
    ) {
    }

    public static function create(CardGateway $cards, CardAuditGateway $audit): self
    {
        return new self($cards, $audit);
    }

    /** @return list<CardAuditEntry> */
    public function execute(int $cardId): array
    {
        if ($this->cards->findByIdIncludingDeleted($cardId) === null) {
            throw new NotFoundError('Carta não encontrada.');
        }

        return $this->audit->listForCard($cardId, self::MAX_ENTRIES);
    }
}
