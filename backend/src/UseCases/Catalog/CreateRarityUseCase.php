<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

use App\Domain\Catalog\Gateway\GameGateway;
use App\Domain\Catalog\Gateway\RarityGateway;
use App\Domain\Catalog\Validation\CatalogItemRules;
use App\Domain\Errors\ConflictError;
use App\Domain\Errors\NotFoundError;
use App\Domain\Errors\ValidationError;
use App\Shared\Enum\RarityColor;
use App\Shared\Observability\Logger;

/**
 * Cria uma raridade dentro de um jogo, com a cor do selo.
 *
 * Código e nome seguem as mesmas regras da edição (CatalogItemRules). A cor é
 * o que separou as duas escritas: uma chave da paleta, ou nenhuma — e nenhuma
 * é grafite, o selo neutro.
 */
final class CreateRarityUseCase
{
    private function __construct(
        private readonly GameGateway $games,
        private readonly RarityGateway $rarities,
        private readonly Logger $logger,
    ) {
    }

    public static function create(GameGateway $games, RarityGateway $rarities, Logger $logger): self
    {
        return new self($games, $rarities, $logger);
    }

    public function execute(CreateRarityInput $input): int
    {
        $game = $this->games->findBySlug($input->gameSlug);

        if ($game === null) {
            throw new NotFoundError('Card game não encontrado.');
        }

        $code = CatalogItemRules::normalizeCode($input->code);
        $name = trim($input->name);
        $color = $input->color === null ? RarityColor::DEFAULT : RarityColor::tryFrom($input->color);
        $errors = CatalogItemRules::errors($code, $name);

        if ($color === null) {
            $errors['color'] = 'Escolha uma das cores da paleta.';
        }

        if ($errors !== []) {
            throw ValidationError::fields($errors);
        }

        if ($this->rarities->existsWithCode($game->id, $code, null)) {
            throw new ConflictError('Já existe uma raridade com este código neste Card Game.');
        }

        $id = $this->rarities->insert($game->id, $code, $name, $input->sortOrder, $color);

        $this->logger->info('Item de catálogo criado', ['type' => 'raridade', 'gameId' => $game->id, 'itemId' => $id]);

        return $id;
    }
}
