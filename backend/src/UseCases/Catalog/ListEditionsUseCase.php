<?php

declare(strict_types=1);

namespace App\UseCases\Catalog;

use App\Domain\Catalog\Entity\Edition;
use App\Domain\Catalog\Gateway\EditionGateway;
use App\Domain\Catalog\Gateway\GameGateway;
use App\Domain\Errors\NotFoundError;

/**
 * As edições de um jogo.
 *
 * É o endpoint que o requisito 2.a do enunciado dispara ao selecionar o Card
 * Game. Jogo inexistente ou inativo responde 404 — e não lista vazia: lista
 * vazia diria ao usuário "este jogo não tem edições", que é uma informação
 * diferente e falsa.
 */
final class ListEditionsUseCase
{
    private function __construct(
        private readonly GameGateway $games,
        private readonly EditionGateway $editions,
    ) {
    }

    public static function create(GameGateway $games, EditionGateway $editions): self
    {
        return new self($games, $editions);
    }

    /** @return list<Edition> */
    public function execute(string $gameSlug): array
    {
        $game = $this->games->findBySlug($gameSlug);

        if ($game === null || !$game->active) {
            throw new NotFoundError('Card game não encontrado.');
        }

        return $this->editions->listActiveByGame($game->id);
    }
}
