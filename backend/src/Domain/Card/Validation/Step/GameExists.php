<?php

declare(strict_types=1);

namespace App\Domain\Card\Validation\Step;

use App\Domain\Card\Validation\CardDraft;
use App\Domain\Card\Validation\CardValidation;
use App\Domain\Card\Validation\CardValidationStep;
use App\Domain\Catalog\Gateway\GameGateway;

/**
 * O jogo existe e está ativo.
 *
 * Este é o elo que **interrompe** a cadeia quando falha: sem o jogo resolvido,
 * validar edição e raridade produziria erros derivados ("a edição não pertence
 * ao jogo") que confundem mais do que ajudam — o problema real é outro.
 */
final class GameExists implements CardValidationStep
{
    public function __construct(
        private readonly GameGateway $games,
    ) {
    }

    public function apply(CardDraft $draft, CardValidation $validation): void
    {
        $game = $this->games->findBySlug($draft->gameSlug);

        if ($game === null || !$game->active) {
            $validation->addError('game', 'Selecione um Card Game válido.');
            $validation->halt();

            return;
        }

        $validation->resolveGame($game);
    }
}
