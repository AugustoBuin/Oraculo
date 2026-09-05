<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Card;

use App\Infra\Http\Presenter\CardPresenter;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\Shared\Enum\HttpStatus;
use App\UseCases\Card\ListCardsInput;
use App\UseCases\Card\ListCardsUseCase;

/**
 * Listagem de cartas, com busca, filtros e paginação.
 *
 * O envelope `{data, pagination}` é o mesmo de toda listagem do sistema: um
 * formato único decidido no começo evita que cada tela do frontend precise
 * descobrir como ler a resposta daquele endpoint específico.
 */
final class ListCardsRoute implements Route
{
    private function __construct(
        private readonly ListCardsUseCase $useCase,
    ) {
    }

    public static function create(ListCardsUseCase $useCase): self
    {
        return new self($useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::GET;
    }

    public function path(): string
    {
        return '/api/cards';
    }

    public function handle(Request $request): Response
    {
        $result = $this->useCase->execute(new ListCardsInput(
            page: $request->query('page'),
            perPage: $request->query('perPage'),
            search: $request->query('search'),
            gameSlug: $request->query('game'),
            editionCode: $request->query('edition'),
            rarityCode: $request->query('rarity'),
            sort: $request->query('sort'),
        ));

        $perPage = $result['perPage'];
        $total = $result['total'];

        return Response::json(HttpStatus::OK, [
            'data' => CardPresenter::collection($result['items']),
            'pagination' => [
                'page' => $result['page'],
                'perPage' => $perPage,
                'total' => $total,
                'totalPages' => $perPage > 0 ? (int) ceil($total / $perPage) : 0,
            ],
        ]);
    }
}
