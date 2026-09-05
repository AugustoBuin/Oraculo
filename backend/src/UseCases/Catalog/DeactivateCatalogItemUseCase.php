<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

use App\Domain\Catalog\Gateway\CatalogItemGateway;
use App\Domain\Errors\NotFoundError;
use App\Shared\Observability\Logger;

/**
 * Desativa um item de catálogo.
 *
 * **Não existe exclusão aqui, e isso é a decisão de produto do RF-43.**
 *
 * Apagar uma edição levaria junto todas as cartas dela. Um portal
 * administrativo não pode ter um botão cuja consequência real o usuário não
 * consegue prever — e o que ele espera ao clicar é "some da lista", não "apaga
 * quatrocentas cartas".
 *
 * Desativar entrega o que ele quer (sumir das opções de cadastro novo) e
 * preserva o que ele não pensou (as cartas existentes continuam exibindo o nome
 * correto). Por isso a operação **nunca falha por estar em uso**: estar em uso é
 * justamente a situação para a qual ela foi projetada.
 *
 * O que a operação devolve é quantas cartas usam o item, para que a interface
 * possa dizer "esta edição é usada por 12 cartas; elas continuam como estão".
 * Avisar depois de agir é honesto quando a ação é reversível — e reativar é um
 * clique no mesmo lugar.
 */
final class DeactivateCatalogItemUseCase
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

    /** @return bool se o item estava em uso por alguma carta */
    public function execute(int $itemId): bool
    {
        if ($this->items->gameIdOf($itemId) === null) {
            throw new NotFoundError(ucfirst($this->items->label()) . ' não encontrada.');
        }

        $inUse = $this->items->isInUse($itemId);

        $this->items->deactivate($itemId);

        $this->logger->info('Item de catálogo desativado', [
            'type' => $this->items->label(),
            'itemId' => $itemId,
            'inUse' => $inUse,
        ]);

        return $inUse;
    }
}
