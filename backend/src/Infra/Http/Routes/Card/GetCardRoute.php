<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Card;

use App\Infra\Http\Presenter\CardPresenter;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\UseCases\Card\GetCardUseCase;

final class GetCardRoute implements Route
{
    private function __construct(
        private readonly GetCardUseCase $useCase,
    ) {
    }

    public static function create(GetCardUseCase $useCase): self
    {
        return new self($useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::GET;
    }

    public function path(): string
    {
        return '/api/cards/{id}';
    }

    public function handle(Request $request): Response
    {
        return Response::ok(
            CardPresenter::toArray($this->useCase->execute((int) $request->param('id')))
        );
    }
}
