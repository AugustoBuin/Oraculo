<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Catalog;

use App\Domain\User\Entity\User;
use App\Infra\Http\Guard;
use App\Infra\Http\Presenter\CatalogPresenter;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\Shared\Enum\PermissionLevel;
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
        /** @var User $user o guard já garantiu que existe */
        $user = $request->attribute(Guard::USER_ATTRIBUTE);

        // O parâmetro é um PEDIDO, não uma permissão: quem decide se ele vale
        // é o caso de uso, pelo nível da sessão. Aqui só se lê o que o cliente
        // mandou.
        $includeInactive = $request->query('incluirInativos') === '1';
        $asAdmin = $includeInactive && $user->can(PermissionLevel::ADMIN);

        $items = $this->useCase->execute(
            (string) $request->param('gameId'),
            $user->level,
            $includeInactive
        );

        return Response::ok(CatalogPresenter::rarities($items, $asAdmin));
    }
}
