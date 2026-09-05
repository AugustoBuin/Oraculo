<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Card;

use App\Domain\User\Entity\User;
use App\Infra\Http\Guard;
use App\Infra\Http\Presenter\CardPresenter;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\UseCases\Card\RestoreCardUseCase;

/**
 * O "Desfazer" da exclusão.
 */
final class RestoreCardRoute implements Route
{
    private function __construct(
        private readonly RestoreCardUseCase $useCase,
    ) {
    }

    public static function create(RestoreCardUseCase $useCase): self
    {
        return new self($useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::POST;
    }

    public function path(): string
    {
        return '/api/cards/{id}/restore';
    }

    public function handle(Request $request): Response
    {
        /** @var User $user */
        $user = $request->attribute(Guard::USER_ATTRIBUTE);

        return Response::ok(CardPresenter::toArray(
            $this->useCase->execute((int) $request->param('id'), $user->id)
        ));
    }
}
