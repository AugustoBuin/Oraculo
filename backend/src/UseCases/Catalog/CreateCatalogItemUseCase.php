<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

use App\Domain\Catalog\Gateway\CatalogItemGateway;
use App\Domain\Catalog\Gateway\GameGateway;
use App\Domain\Catalog\Validation\CatalogItemRules;
use App\Domain\Errors\ConflictError;
use App\Domain\Errors\NotFoundError;
use App\Domain\Errors\ValidationError;
use App\Shared\Observability\Logger;

/**
 * Cria uma edição ou uma raridade dentro de um jogo.
 *
 * É a operação que dá sentido ao nível ADMIN — e à tese do produto: abrir o
 * catálogo de um TCG novo passa a ser cadastro, não deploy.
 */
final class CreateCatalogItemUseCase
{
    private function __construct(
        private readonly GameGateway $games,
        private readonly CatalogItemGateway $items,
        private readonly Logger $logger,
    ) {
    }

    public static function create(GameGateway $games, CatalogItemGateway $items, Logger $logger): self
    {
        return new self($games, $items, $logger);
    }

    public function execute(SaveCatalogItemInput $input): int
    {
        $game = $this->games->findBySlug($input->gameSlug);

        if ($game === null) {
            throw new NotFoundError('Card game não encontrado.');
        }

        $code = CatalogItemRules::normalizeCode((string) $input->code);
        $name = trim($input->name);
        $errors = CatalogItemRules::errors($code, $name);

        if ($errors !== []) {
            throw ValidationError::fields($errors);
        }

        if ($this->items->existsWithCode($game->id, $code, null)) {
            throw new ConflictError(
                'Já existe uma ' . $this->items->label() . ' com este código neste Card Game.'
            );
        }

        $id = $this->items->insert($game->id, $code, $name, $input->sortOrder);

        $this->logger->info('Item de catálogo criado', [
            'type' => $this->items->label(),
            'gameId' => $game->id,
            'itemId' => $id,
        ]);

        return $id;
    }
}
