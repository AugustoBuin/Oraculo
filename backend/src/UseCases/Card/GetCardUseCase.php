<?php

declare(strict_types=1);

namespace App\UseCases\Card;

use App\Domain\Card\Entity\Card;
use App\Domain\Card\Gateway\CardGateway;
use App\Domain\Errors\NotFoundError;

/**
 * Uma carta pelo id.
 *
 * Fino de propósito, e ainda assim um caso de uso: é aqui que entraria a
 * verificação de posse se algum dia existir carta com dono. Hoje o catálogo é
 * compartilhado e a autorização é integralmente por nível — decisão avaliada e
 * registrada em docs/decisions/ADR-006, para que uma auditoria futura saiba que
 * a ausência de checagem de posse foi deliberada e não esquecimento.
 */
final class GetCardUseCase
{
    private function __construct(
        private readonly CardGateway $cards,
    ) {
    }

    public static function create(CardGateway $cards): self
    {
        return new self($cards);
    }

    public function execute(int $cardId): Card
    {
        $card = $this->cards->findById($cardId);

        if ($card === null) {
            throw new NotFoundError('Carta não encontrada.');
        }

        return $card;
    }
}
