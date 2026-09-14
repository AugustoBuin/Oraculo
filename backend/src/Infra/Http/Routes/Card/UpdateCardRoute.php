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
use App\UseCases\Card\SaveCardInput;
use App\UseCases\Card\UpdateCardUseCase;

final class UpdateCardRoute implements Route
{
    private function __construct(
        private readonly UpdateCardUseCase $useCase,
    ) {
    }

    public static function create(UpdateCardUseCase $useCase): self
    {
        return new self($useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::PUT;
    }

    public function path(): string
    {
        return '/api/cards/{id}';
    }

    public function handle(Request $request): Response
    {
        /** @var User $user */
        $user = $request->attribute(Guard::USER_ATTRIBUTE);

        $card = $this->useCase->execute(new SaveCardInput(
            draft: CardRequestReader::draft($request),
            authorId: $user->id,
            confirmDuplicate: CardRequestReader::confirmDuplicate($request),
            // O id vem do CAMINHO, não do corpo. Aceitar do corpo permitiria
            // alterar uma carta enquanto a URL diz outra.
            cardId: (int) $request->param('id'),
        ));

        return Response::ok(CardPresenter::toArray($card));
    }
}
