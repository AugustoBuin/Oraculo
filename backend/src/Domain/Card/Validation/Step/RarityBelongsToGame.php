<?php

declare(strict_types=1);

namespace App\Domain\Card\Validation\Step;

use App\Domain\Card\Validation\CardDraft;
use App\Domain\Card\Validation\CardValidation;
use App\Domain\Card\Validation\CardValidationStep;
use App\Domain\Catalog\Gateway\RarityGateway;

/**
 * A raridade existe **e pertence ao jogo selecionado** (RN-02).
 *
 * Este elo é a Decisão de UX nº 1 aplicada no servidor. A interface já impede o
 * erro ao recarregar o `<select>` quando o jogo muda, mas interface é
 * conveniência: sem esta checagem, uma requisição montada à mão gravaria uma
 * carta de Magic com raridade "Secret Rare", que só existe em Yu-Gi-Oh!.
 */
final class RarityBelongsToGame implements CardValidationStep
{
    public function __construct(
        private readonly RarityGateway $rarities,
    ) {
    }

    public function apply(CardDraft $draft, CardValidation $validation): void
    {
        $game = $validation->game();

        if ($game === null) {
            return;
        }

        $rarity = $this->rarities->findByGameAndCode($game->id, $draft->rarityCode);

        if ($rarity === null || !$rarity->active) {
            $validation->addError('rarityId', 'Selecione uma raridade válida para este Card Game.');

            return;
        }

        $validation->resolveRarity($rarity);
    }
}
