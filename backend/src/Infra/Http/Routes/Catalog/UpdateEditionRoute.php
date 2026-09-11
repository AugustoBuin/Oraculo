<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Catalog;

use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\UseCases\Catalog\UpdateEditionInput;
use App\UseCases\Catalog\UpdateEditionUseCase;

/**
 * Renomeia, reordena, desativa ou reativa uma edição.
 *
 * O `code` não é lido do corpo de propósito: identificador público não muda.
 */
final class UpdateEditionRoute implements Route
{
    private function __construct(
        private readonly UpdateEditionUseCase $useCase,
    ) {
    }

    public static function create(UpdateEditionUseCase $useCase): self
    {
        return new self($useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::PUT;
    }

    public function path(): string
    {
        return '/api/editions/{id}';
    }

    public function handle(Request $request): Response
    {
        $this->useCase->execute(new UpdateEditionInput(
            editionId: (int) $request->param('id'),
            name: is_string($request->body('name')) ? $request->body('name') : '',
            sortOrder: is_int($request->body('sortOrder')) ? $request->body('sortOrder') : 0,
            // Ausente significa "mantém ativo": a reativação é explícita, e
            // esquecer o campo não pode desativar um item por acidente.
            active: $request->body('active') !== false,
        ));

        return Response::noContent();
    }
}
