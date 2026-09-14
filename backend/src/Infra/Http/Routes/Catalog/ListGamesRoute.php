<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Catalog;

use App\Infra\Http\Presenter\CatalogPresenter;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\UseCases\Catalog\ListGamesUseCase;

/**
 * Os Card Games disponíveis — o primeiro degrau da cascata.
 */
final class ListGamesRoute implements Route
{
    private function __construct(
        private readonly ListGamesUseCase $useCase,
    ) {
    }

    public static function create(ListGamesUseCase $useCase): self
    {
        return new self($useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::GET;
    }

    public function path(): string
    {
        return '/api/games';
    }

    public function handle(Request $request): Response
    {
        return Response::ok(CatalogPresenter::games($this->useCase->execute()));
    }
}
