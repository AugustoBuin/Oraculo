<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Catalog;

use App\Infra\Http\Presenter\CatalogPresenter;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\UseCases\Catalog\ListRaritiesUseCase;

/**
 * As raridades de um jogo.
 *
 * Endpoint que o enunciado não pediu. Ele existe porque raridade é específica
 * de cada TCG — Magic tem Mítica, Yu-Gi-Oh! tem Super Rara, Pokémon tem Rara
 * Holo — e um campo de texto livre permitiria cadastrar carta de Magic como
 * "Secret Rare" (docs/PRD.md, seção 6, decisão 1).
 */
final class ListRaritiesRoute implements Route
{
    private function __construct(
        private readonly ListRaritiesUseCase $useCase,
    ) {
    }

    public static function create(ListRaritiesUseCase $useCase): self
    {
        return new self($useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::GET;
    }

    public function path(): string
    {
        return '/api/games/{gameId}/rarities';
    }

    public function handle(Request $request): Response
    {
        return Response::ok(
            CatalogPresenter::rarities($this->useCase->execute((string) $request->param('gameId')))
        );
    }
}
