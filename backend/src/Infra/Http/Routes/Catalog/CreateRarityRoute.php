<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Catalog;

use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\Shared\Enum\HttpStatus;
use App\UseCases\Catalog\CreateRarityInput;
use App\UseCases\Catalog\CreateRarityUseCase;

/** Cria uma raridade, com a cor do selo. O corpo é lido campo a campo. */
final class CreateRarityRoute implements Route
{
    private function __construct(
        private readonly CreateRarityUseCase $useCase,
    ) {
    }

    public static function create(CreateRarityUseCase $useCase): self
    {
        return new self($useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::POST;
    }

    public function path(): string
    {
        return '/api/games/{gameId}/rarities';
    }

    public function handle(Request $request): Response
    {
        $id = $this->useCase->execute(new CreateRarityInput(
            gameSlug: (string) $request->param('gameId'),
            code: is_string($request->body('code')) ? $request->body('code') : '',
            name: is_string($request->body('name')) ? $request->body('name') : '',
            sortOrder: is_int($request->body('sortOrder')) ? $request->body('sortOrder') : 0,
            color: ColorField::read($request),
        ));

        return Response::json(HttpStatus::CREATED, ['data' => ['id' => $id]]);
    }
}
