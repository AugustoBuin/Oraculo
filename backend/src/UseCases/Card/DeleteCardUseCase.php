<?php

declare(strict_types=1);

namespace App\UseCases\Card;

use App\Domain\Card\Event\CardChanged;
use App\Domain\Card\Gateway\CardGateway;
use App\Domain\Errors\NotFoundError;
use App\Shared\Clock\Clock;
use App\Shared\Enum\CardAction;
use App\Shared\Event\EventDispatcher;
use App\Shared\Observability\Logger;

/**
 * Exclui uma carta — logicamente.
 *
 * A metade visível desta operação é a interface: modal que nomeia a carta e
 * aviso com "Desfazer". A metade que a sustenta é esta: sem exclusão lógica,
 * não existe desfazer, e a confirmação viraria a única proteção — que qualquer
 * pessoa lê no automático depois da décima vez.
 *
 * **A proteção real não é a confirmação, é a reversibilidade** (docs/PRD.md,
 * seção 6, decisão 2).
 */
final class DeleteCardUseCase
{
    private function __construct(
        private readonly CardGateway $cards,
        private readonly EventDispatcher $events,
        private readonly Clock $clock,
        private readonly Logger $logger,
    ) {
    }

    public static function create(
        CardGateway $cards,
        EventDispatcher $events,
        Clock $clock,
        Logger $logger,
    ): self {
        return new self($cards, $events, $clock, $logger);
    }

    public function execute(int $cardId, int $userId): void
    {
        // findById não devolve carta já excluída, então excluir duas vezes
        // responde 404 em vez de registrar dois eventos.
        if ($this->cards->findById($cardId) === null) {
            throw new NotFoundError('Carta não encontrada.');
        }

        $this->cards->softDelete($cardId, $userId, $this->clock->now());

        $this->events->dispatch(new CardChanged($cardId, $userId, CardAction::DELETED));

        $this->logger->info('Carta excluída', ['cardId' => $cardId, 'userId' => $userId]);
    }
}
