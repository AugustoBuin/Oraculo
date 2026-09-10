<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

use App\Domain\Catalog\Gateway\EditionGateway;
use App\Domain\Catalog\Gateway\GameGateway;
use App\Domain\Catalog\Validation\CatalogItemRules;
use App\Domain\Errors\ConflictError;
use App\Domain\Errors\NotFoundError;
use App\Domain\Errors\ValidationError;
use App\Shared\Observability\Logger;

/**
 * Cria uma edição dentro de um jogo.
 *
 * É a operação que dá sentido ao nível ADMIN — e à tese do produto: uma
 * edição nova de Pokémon entra em produção por cadastro, não por deploy.
 */
final class CreateEditionUseCase
{
    private function __construct(
        private readonly GameGateway $games,
        private readonly EditionGateway $editions,
        private readonly Logger $logger,
    ) {
    }

    public static function create(GameGateway $games, EditionGateway $editions, Logger $logger): self
    {
        return new self($games, $editions, $logger);
    }

    public function execute(CreateEditionInput $input): int
    {
        $game = $this->games->findBySlug($input->gameSlug);

        if ($game === null) {
            throw new NotFoundError('Card game não encontrado.');
        }

        $code = CatalogItemRules::normalizeCode($input->code);
        $name = trim($input->name);
        $errors = CatalogItemRules::errors($code, $name);

        if ($errors !== []) {
            throw ValidationError::fields($errors);
        }

        if ($this->editions->existsWithCode($game->id, $code, null)) {
            throw new ConflictError('Já existe uma edição com este código neste Card Game.');
        }

        $id = $this->editions->insert($game->id, $code, $name, $input->sortOrder);

        $this->logger->info('Item de catálogo criado', ['type' => 'edição', 'gameId' => $game->id, 'itemId' => $id]);

        return $id;
    }
}
