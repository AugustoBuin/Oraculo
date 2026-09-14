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
use App\UseCases\Catalog\ListEditionsUseCase;

/**
 * As edições de um jogo.
 *
 * É este endpoint que o requisito 2.a do enunciado dispara quando o usuário
 * seleciona o Card Game — e é a resposta dele que popula o `<select>` de
 * Edição, no formato `{id, name}` que o próprio enunciado publicou.
 */
final class ListEditionsRoute implements Route
{
    private function __construct(
        private readonly ListEditionsUseCase $useCase,
    ) {
    }

    public static function create(ListEditionsUseCase $useCase): self
    {
        return new self($useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::GET;
    }

    public function path(): string
    {
        return '/api/games/{gameId}/editions';
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

        return Response::ok(CatalogPresenter::editions($items, $asAdmin));
    }
}
