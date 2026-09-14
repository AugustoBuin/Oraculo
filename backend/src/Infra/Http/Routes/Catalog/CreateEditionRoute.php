<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Catalog;

use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\Shared\Enum\HttpStatus;
use App\UseCases\Catalog\CreateEditionInput;
use App\UseCases\Catalog\CreateEditionUseCase;

/** Cria uma edição. O corpo é lido campo a campo, nunca repassado inteiro. */
final class CreateEditionRoute implements Route
{
    private function __construct(
        private readonly CreateEditionUseCase $useCase,
    ) {
    }

    public static function create(CreateEditionUseCase $useCase): self
    {
        return new self($useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::POST;
    }

    public function path(): string
    {
        return '/api/games/{gameId}/editions';
    }

    public function handle(Request $request): Response
    {
        $id = $this->useCase->execute(new CreateEditionInput(
            gameSlug: (string) $request->param('gameId'),
            code: is_string($request->body('code')) ? $request->body('code') : '',
            name: is_string($request->body('name')) ? $request->body('name') : '',
            sortOrder: is_int($request->body('sortOrder')) ? $request->body('sortOrder') : 0,
        ));

        return Response::json(HttpStatus::CREATED, ['data' => ['id' => $id]]);
    }
}
