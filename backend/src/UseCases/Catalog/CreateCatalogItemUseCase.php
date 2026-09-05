<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

use App\Domain\Catalog\Gateway\CatalogItemGateway;
use App\Domain\Catalog\Gateway\GameGateway;
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
    private const CODE_PATTERN = '/^[a-z0-9][a-z0-9-]{0,31}$/';

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

        $errors = [];
        $code = strtolower(trim((string) $input->code));
        $name = trim($input->name);

        if (preg_match(self::CODE_PATTERN, $code) !== 1) {
            // O código vira parte da URL pública e do contrato da API: letras
            // minúsculas, números e hífen, sem espaço nem acento.
            $errors['code'] = 'Use apenas letras minúsculas, números e hífen, até 32 caracteres.';
        }

        if ($name === '') {
            $errors['name'] = 'O nome é obrigatório.';
        }

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
