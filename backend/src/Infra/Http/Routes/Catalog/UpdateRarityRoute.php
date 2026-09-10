<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Catalog;

use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\UseCases\Catalog\UpdateRarityInput;
use App\UseCases\Catalog\UpdateRarityUseCase;

/**
 * Renomeia, reordena, desativa, reativa ou pinta uma raridade.
 *
 * O `code` não é lido do corpo de propósito: identificador público não muda.
 */
final class UpdateRarityRoute implements Route
{
    private function __construct(
        private readonly UpdateRarityUseCase $useCase,
    ) {
    }

    public static function create(UpdateRarityUseCase $useCase): self
    {
        return new self($useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::PUT;
    }

    public function path(): string
    {
        return '/api/rarities/{id}';
    }

    public function handle(Request $request): Response
    {
        $this->useCase->execute(new UpdateRarityInput(
            rarityId: (int) $request->param('id'),
            name: is_string($request->body('name')) ? $request->body('name') : '',
            sortOrder: is_int($request->body('sortOrder')) ? $request->body('sortOrder') : 0,
            // Ausente significa "mantém ativo": a reativação é explícita, e
            // esquecer o campo não pode desativar um item por acidente.
            active: $request->body('active') !== false,
            color: ColorField::read($request),
        ));

        return Response::noContent();
    }
}
