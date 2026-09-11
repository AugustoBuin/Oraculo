<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

use App\Domain\Catalog\Gateway\RarityGateway;
use App\Domain\Catalog\Validation\CatalogItemRules;
use App\Domain\Errors\NotFoundError;
use App\Domain\Errors\ValidationError;
use App\Shared\Enum\RarityColor;
use App\Shared\Observability\Logger;

/**
 * Renomeia, reordena, desativa, reativa ou pinta uma raridade.
 *
 * **A cor é obrigatória aqui**, ao contrário da criação. O `PUT` é
 * substituição: um cliente que esquecesse o campo pintaria de grafite, em
 * silêncio, a raridade que era ouro. Recusar é o que torna o esquecimento
 * visível — o mesmo defeito que já zerava a ordem na reativação.
 */
final class UpdateRarityUseCase
{
    private function __construct(
        private readonly RarityGateway $rarities,
        private readonly Logger $logger,
    ) {
    }

    public static function create(RarityGateway $rarities, Logger $logger): self
    {
        return new self($rarities, $logger);
    }

    public function execute(UpdateRarityInput $input): void
    {
        if ($this->rarities->gameIdOf($input->rarityId) === null) {
            throw new NotFoundError('Raridade não encontrada.');
        }

        $name = trim($input->name);
        $color = $input->color === null ? null : RarityColor::tryFrom($input->color);
        $errors = CatalogItemRules::nameErrors($name);

        if ($color === null) {
            $errors['color'] = 'Escolha uma das cores da paleta.';
        }

        if ($errors !== []) {
            throw ValidationError::fields($errors);
        }

        $this->rarities->updateDetails($input->rarityId, $name, $input->sortOrder, $input->active, $color);

        $this->logger->info('Item de catálogo alterado', ['type' => 'raridade', 'itemId' => $input->rarityId]);
    }
}
