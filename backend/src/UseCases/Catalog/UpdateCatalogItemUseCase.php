<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

use App\Domain\Catalog\Gateway\CatalogItemGateway;
use App\Domain\Errors\NotFoundError;
use App\Domain\Errors\ValidationError;
use App\Shared\Observability\Logger;

/**
 * Renomeia, reordena ou reativa um item de catálogo.
 *
 * **O código não é alterável.** Ele é o identificador público do item: aparece
 * na URL, no contrato da API e em qualquer filtro que alguém tenha salvo.
 * Trocá-lo quebraria tudo isso em silêncio — e o ganho seria corrigir um erro
 * de digitação que o nome já resolve.
 */
final class UpdateCatalogItemUseCase
{
    private function __construct(
        private readonly CatalogItemGateway $items,
        private readonly Logger $logger,
    ) {
    }

    public static function create(CatalogItemGateway $items, Logger $logger): self
    {
        return new self($items, $logger);
    }

    public function execute(int $itemId, string $name, int $sortOrder, bool $active): void
    {
        if ($this->items->gameIdOf($itemId) === null) {
            throw new NotFoundError(ucfirst($this->items->label()) . ' não encontrada.');
        }

        $trimmed = trim($name);

        if ($trimmed === '') {
            throw ValidationError::field('name', 'O nome é obrigatório.');
        }

        $this->items->updateDetails($itemId, $trimmed, $sortOrder, $active);

        $this->logger->info('Item de catálogo alterado', [
            'type' => $this->items->label(),
            'itemId' => $itemId,
        ]);
    }
}
