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
use App\UseCases\Card\CreateCardUseCase;
use App\UseCases\Card\SaveCardInput;

final class CreateCardRoute implements Route
{
    private function __construct(
        private readonly CreateCardUseCase $useCase,
    ) {
    }

    public static function create(CreateCardUseCase $useCase): self
    {
        return new self($useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::POST;
    }

    public function path(): string
    {
        return '/api/cards';
    }

    public function handle(Request $request): Response
    {
        /** @var User $user o guard já garantiu que existe */
        $user = $request->attribute(Guard::USER_ATTRIBUTE);

        $card = $this->useCase->execute(new SaveCardInput(
            draft: CardRequestReader::draft($request),
            // Da SESSÃO, nunca do corpo: aceitar o autor do cliente permitiria
            // atribuir a criação a outra pessoa.
            authorId: $user->id,
            confirmDuplicate: CardRequestReader::confirmDuplicate($request),
        ));

        return Response::created(CardPresenter::toArray($card), '/api/cards/' . $card->id);
    }
}
