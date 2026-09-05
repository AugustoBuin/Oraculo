<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Auth;

use App\Domain\Session\Entity\Session;
use App\Domain\User\Entity\User;
use App\Infra\Http\Guard;
use App\Infra\Http\Middleware\SessionMiddleware;
use App\Infra\Http\Presenter\UserPresenter;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;

/**
 * A sessão corrente.
 *
 * É o que o frontend chama ao carregar, para decidir entre a tela de login e a
 * aplicação — e para rebuscar o token anti-CSRF, que vive em memória no cliente
 * e se perde a cada recarga (o token NÃO fica em localStorage: o que o
 * JavaScript guarda, um XSS lê).
 *
 * Responder 401 aqui é o caminho normal de quem ainda não entrou, não um
 * incidente. É o guard que produz esse 401, não esta rota.
 */
final class CurrentSessionRoute implements Route
{
    public static function create(): self
    {
        return new self();
    }

    public function method(): HttpMethod
    {
        return HttpMethod::GET;
    }

    public function path(): string
    {
        return '/api/auth/session';
    }

    public function handle(Request $request): Response
    {
        /** @var User $user o guard já garantiu que existe */
        $user = $request->attribute(Guard::USER_ATTRIBUTE);
        /** @var Session $session */
        $session = $request->attribute(SessionMiddleware::SESSION_ATTRIBUTE);

        return Response::ok([
            'user' => UserPresenter::toArray($user),
            'csrfToken' => $session->csrfToken,
            'expiresAt' => $session->expiresAt->format(DATE_ATOM),
        ]);
    }
}
