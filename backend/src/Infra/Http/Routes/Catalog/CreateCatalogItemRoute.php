<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Catalog;

use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\Shared\Enum\HttpStatus;
use App\UseCases\Catalog\CreateCatalogItemUseCase;
use App\UseCases\Catalog\SaveCatalogItemInput;

/**
 * Cria uma edição ou uma raridade.
 *
 * Uma classe instanciada duas vezes, com caminhos diferentes, em vez de duas
 * classes idênticas: a escrita de edição e a de raridade são a mesma operação
 * sobre a mesma forma de dado, e duplicá-las só criaria dois lugares para
 * corrigir o mesmo defeito.
 */
final class CreateCatalogItemRoute implements Route
{
    private function __construct(
        private readonly string $path,
        private readonly CreateCatalogItemUseCase $useCase,
    ) {
    }

    public static function create(string $path, CreateCatalogItemUseCase $useCase): self
    {
        return new self($path, $useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::POST;
    }

    public function path(): string
    {
        return $this->path;
    }

    public function handle(Request $request): Response
    {
        $id = $this->useCase->execute(new SaveCatalogItemInput(
            gameSlug: (string) $request->param('gameId'),
            name: is_string($request->body('name')) ? $request->body('name') : '',
            code: is_string($request->body('code')) ? $request->body('code') : '',
            sortOrder: is_int($request->body('sortOrder')) ? $request->body('sortOrder') : 0,
        ));

        return Response::json(HttpStatus::CREATED, ['data' => ['id' => $id]]);
    }
}
