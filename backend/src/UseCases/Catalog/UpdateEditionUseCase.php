<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

use App\Domain\Catalog\Gateway\EditionGateway;
use App\Domain\Catalog\Validation\CatalogItemRules;
use App\Domain\Errors\NotFoundError;
use App\Domain\Errors\ValidationError;
use App\Shared\Observability\Logger;

/**
 * Renomeia, reordena, desativa ou reativa uma edição.
 *
 * **O código não é alterável** — nem chega aqui: a entrada não tem o campo.
 * Ele é o identificador público, e trocá-lo quebraria em silêncio toda URL e
 * todo filtro salvo que apontasse para ele.
 */
final class UpdateEditionUseCase
{
    private function __construct(
        private readonly EditionGateway $editions,
        private readonly Logger $logger,
    ) {
    }

    public static function create(EditionGateway $editions, Logger $logger): self
    {
        return new self($editions, $logger);
    }

    public function execute(UpdateEditionInput $input): void
    {
        if ($this->editions->gameIdOf($input->editionId) === null) {
            throw new NotFoundError('Edição não encontrada.');
        }

        $name = trim($input->name);
        $errors = CatalogItemRules::nameErrors($name);

        if ($errors !== []) {
            throw ValidationError::fields($errors);
        }

        $this->editions->updateDetails($input->editionId, $name, $input->sortOrder, $input->active);

        $this->logger->info('Item de catálogo alterado', ['type' => 'edição', 'itemId' => $input->editionId]);
    }
}
