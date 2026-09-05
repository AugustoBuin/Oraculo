<?php

declare(strict_types=1);

namespace App\UseCases\Card;

use App\Domain\Card\Entity\Card;
use App\Domain\Card\Event\CardChanged;
use App\Domain\Card\Gateway\CardGateway;
use App\Domain\Errors\ConflictError;
use App\Domain\Errors\NotFoundError;
use App\Shared\Clock\Clock;
use App\Shared\Enum\CardAction;
use App\Shared\Event\EventDispatcher;
use App\Shared\Observability\Logger;

/**
 * Restaura uma carta excluída — o "Desfazer" da Decisão de UX nº 2.
 *
 * É o que transforma a exclusão de um erro caro num erro barato: o usuário
 * clicou errado, clica em desfazer, e a carta volta com tudo, inclusive o
 * histórico.
 */
final class RestoreCardUseCase
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

    public function execute(int $cardId, int $userId): Card
    {
        $card = $this->cards->findByIdIncludingDeleted($cardId);

        if ($card === null) {
            throw new NotFoundError('Carta não encontrada.');
        }

        if (!$card->isDeleted()) {
            // 409 e não 200 silencioso: restaurar algo que não está excluído
            // significa que a interface está mostrando um estado desatualizado,
            // e esconder isso do cliente atrasa o problema.
            throw new ConflictError('Esta carta não está excluída.');
        }

        $this->cards->restore($cardId, $userId, $this->clock->now());

        $this->events->dispatch(new CardChanged($cardId, $userId, CardAction::RESTORED));

        $this->logger->info('Carta restaurada', ['cardId' => $cardId, 'userId' => $userId]);

        $restored = $this->cards->findById($cardId);

        if ($restored === null) {
            throw new \RuntimeException('A carta restaurada não foi encontrada.');
        }

        return $restored;
    }
}
