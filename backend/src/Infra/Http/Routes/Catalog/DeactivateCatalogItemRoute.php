<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Catalog;

use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\UseCases\Catalog\DeactivateCatalogItemUseCase;

/**
 * Desativa uma edição ou raridade.
 *
 * O verbo é DELETE porque é o que o cliente entende por "remover da lista", mas
 * a operação é desativação: apagar de verdade levaria junto as cartas que
 * dependem do item (RF-43).
 *
 * A resposta informa se o item estava em uso, para a interface poder dizer
 * "esta edição é usada por cartas cadastradas; elas continuam como estão".
 */
final class DeactivateCatalogItemRoute implements Route
{
    private function __construct(
        private readonly string $path,
        private readonly DeactivateCatalogItemUseCase $useCase,
    ) {
    }

    public static function create(string $path, DeactivateCatalogItemUseCase $useCase): self
    {
        return new self($path, $useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::DELETE;
    }

    public function path(): string
    {
        return $this->path;
    }

    public function handle(Request $request): Response
    {
        $wasInUse = $this->useCase->execute((int) $request->param('id'));

        return Response::ok([
            'deactivated' => true,
            'wasInUse' => $wasInUse,
        ]);
    }
}
