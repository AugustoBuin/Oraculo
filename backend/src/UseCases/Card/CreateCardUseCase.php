<?php

declare(strict_types=1);

namespace App\UseCases\Card;

use App\Domain\Card\Entity\Card;
use App\Domain\Card\Event\CardChanged;
use App\Domain\Card\Gateway\CardGateway;
use App\Domain\Card\Validation\CardValidationChain;
use App\Domain\Errors\ConflictError;
use App\Shared\Clock\Clock;
use App\Shared\Enum\CardAction;
use App\Shared\Event\EventDispatcher;
use App\Shared\Observability\Logger;

/**
 * Cadastra uma carta.
 *
 * A duplicidade é tratada aqui, e não na cadeia de validação, porque depende do
 * contexto da operação: numa edição a própria carta não conta como duplicata de
 * si mesma. E ela **avisa**, não bloqueia — em card games reais a mesma carta
 * tem várias impressões na mesma edição (terrenos básicos em Magic são o caso
 * clássico). Bloquear seria modelar o domínio errado (RN-04).
 */
final class CreateCardUseCase
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
        $validated = $this->validation->validate($input->draft);

        if (!$input->confirmDuplicate) {
            $duplicate = $this->cards->findDuplicate($validated->edition->id, $validated->nameEn, null);

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

        $card = Card::create($validated, $input->authorId, $this->clock->now());
        $id = $this->cards->insert($card);

        $this->events->dispatch(new CardChanged($id, $input->authorId, CardAction::CREATED));

        $this->logger->info('Carta cadastrada', ['cardId' => $id, 'userId' => $input->authorId]);

        return $this->present($id);
    }

    /**
     * Relê a carta gravada em vez de devolver a que foi montada em memória.
     *
     * Assim a resposta reflete o que ficou no banco — id gerado incluído — e o
     * cliente não recebe um objeto que "quase" corresponde ao registro.
     */
    private function present(int $id): Card
    {
        $saved = $this->cards->findById($id);

        if ($saved === null) {
            throw new \RuntimeException('A carta recém-criada não foi encontrada.');
        }

        return $saved;
    }
}
