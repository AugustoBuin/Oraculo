<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Card;

use App\Domain\User\Entity\User;
use App\Infra\Http\Guard;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\UseCases\Card\DeleteCardUseCase;

/**
 * Exclui uma carta.
 *
 * Exclusão lógica: a carta some das listagens na hora e pode voltar pelo
 * "Desfazer". A confirmação e o aviso vivem na interface; a reversibilidade,
 * que é a proteção de verdade, vive aqui.
 */
final class DeleteCardRoute implements Route
{
    private function __construct(
        private readonly DeleteCardUseCase $useCase,
    ) {
    }

    public static function create(DeleteCardUseCase $useCase): self
    {
        return new self($useCase);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::DELETE;
    }

    public function path(): string
    {
        return '/api/cards/{id}';
    }

    public function handle(Request $request): Response
    {
        /** @var User $user */
        $user = $request->attribute(Guard::USER_ATTRIBUTE);

        $this->useCase->execute((int) $request->param('id'), $user->id);

        return Response::noContent();
    }
}
