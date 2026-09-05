<?php

declare(strict_types=1);

namespace App\Domain\Card\Validation\Step;

use App\Domain\Card\Validation\CardDraft;
use App\Domain\Card\Validation\CardValidation;
use App\Domain\Card\Validation\CardValidationStep;
use App\Domain\Catalog\Gateway\EditionGateway;

/**
 * A edição existe **e pertence ao jogo selecionado** (RN-01).
 *
 * A regra vive na busca, não numa comparação depois dela: o gateway procura por
 * (jogo, código), então uma edição de outro jogo com a mesma sigla simplesmente
 * não é encontrada. Fosse uma comparação posterior, ela seria uma linha que
 * alguém pode remover num refactor sem que nenhum teste de caminho feliz caia.
 */
final class EditionBelongsToGame implements CardValidationStep
{
    public function __construct(
        private readonly EditionGateway $editions,
    ) {
    }

    public function apply(CardDraft $draft, CardValidation $validation): void
    {
        $game = $validation->game();

        if ($game === null) {
            return;
        }

        $edition = $this->editions->findByGameAndCode($game->id, $draft->editionCode);

        if ($edition === null || !$edition->active) {
            $validation->addError('editionId', 'Selecione uma edição válida para este Card Game.');

            return;
        }

        $validation->resolveEdition($edition);
    }
}
