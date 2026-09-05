<?php

declare(strict_types=1);

namespace App\UseCases\Card;

use App\Domain\Card\Entity\Card;
use App\Domain\Card\Event\CardChanged;
use App\Domain\Card\Gateway\CardGateway;
use App\Domain\Card\Validation\CardValidationChain;
use App\Domain\Errors\ConflictError;
use App\Domain\Errors\NotFoundError;
use App\Shared\Clock\Clock;
use App\Shared\Enum\CardAction;
use App\Shared\Event\EventDispatcher;
use App\Shared\Observability\Logger;

/**
 * Altera uma carta existente.
 *
 * Passa pela MESMA cadeia de validação da criação. Uma segunda cadeia — ou uma
 * validação "mais leve" na edição — é como sistemas acabam permitindo pela
 * edição o que proíbem no cadastro.
 */
final class UpdateCardUseCase
{
    private function __construct(
        private readonly CardGateway $cards,
        private readonly CardValidationChain $validation,
        private readonly EventDispatcher $events,
        private readonly Clock $clock,
        private readonly Logger $logger,
    ) {
    }

    public static function create(
        CardGateway $cards,
        CardValidationChain $validation,
        EventDispatcher $events,
        Clock $clock,
        Logger $logger,
    ): self {
        return new self($cards, $validation, $events, $clock, $logger);
    }

    public function execute(SaveCardInput $input): Card
    {
        $cardId = $input->cardId ?? 0;
        $existing = $this->cards->findById($cardId);

        if ($existing === null) {
            throw new NotFoundError('Carta não encontrada.');
        }

        $validated = $this->validation->validate($input->draft);

        if (!$input->confirmDuplicate) {
            // Excluindo a própria carta: ela não é duplicata de si mesma.
            $duplicate = $this->cards->findDuplicate(
                $validated->edition->id,
                $validated->nameEn,
                $cardId
            );

            if ($duplicate !== null) {
                throw new ConflictError('Já existe uma carta com este nome nesta edição.', [
                    'duplicate' => [
                        'id' => $duplicate->id,
                        'nameEn' => $duplicate->nameEn,
                        'edition' => $duplicate->edition->name,
                    ],
                ]);
            }
        }

        $updated = $existing->updatedWith($validated, $input->authorId, $this->clock->now());

        // O diff é calculado ANTES de gravar, comparando os dois estados em
        // memória: depois da gravação o estado anterior já não existe.
        $changes = $existing->changesTo($updated);

        $this->cards->update($updated);

        // Sem mudança real, nenhum evento: uma trilha de auditoria cheia de
        // "alterou nada" é uma trilha que ninguém lê.
        if ($changes !== []) {
            $this->events->dispatch(
                new CardChanged($cardId, $input->authorId, CardAction::UPDATED, $changes)
            );
        }

        $this->logger->info('Carta alterada', [
            'cardId' => $cardId,
            'userId' => $input->authorId,
            'fields' => array_keys($changes),
        ]);

        $saved = $this->cards->findById($cardId);

        if ($saved === null) {
            throw new \RuntimeException('A carta recém-alterada não foi encontrada.');
        }

        return $saved;
    }
}
