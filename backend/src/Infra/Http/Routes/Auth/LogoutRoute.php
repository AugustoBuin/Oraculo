<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Auth;

use App\Domain\Session\Entity\Session;
use App\Infra\Http\Cookie;
use App\Infra\Http\Middleware\SessionMiddleware;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\UseCases\Auth\EndSessionUseCase;

/**
 * Encerra a sessão.
 *
 * **No servidor, não só no cookie** (PADROES.md §5.4). Apagar apenas o cookie
 * deixaria a sessão viva: quem tivesse copiado o valor continuaria autenticado
 * pelas próximas doze horas.
 *
 * O cookie de remoção é enviado junto, com os mesmos atributos do original —
 * um cookie de expiração com atributos diferentes é entendido pelo navegador
 * como outro cookie, e o antigo permanece.
 */
final class LogoutRoute implements Route
{
    private function __construct(
        private readonly EndSessionUseCase $useCase,
        private readonly bool $secureCookie,
    ) {
    }

    public static function create(EndSessionUseCase $useCase, bool $secureCookie): self
    {
        return new self($useCase, $secureCookie);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::DELETE;
    }

    public function path(): string
    {
        return '/api/auth/session';
    }

    public function handle(Request $request): Response
    {
        /** @var Session $session */
        $session = $request->attribute(SessionMiddleware::SESSION_ATTRIBUTE);

        $this->useCase->execute($session->id);

        return Response::noContent()->withCookie(
            Cookie::expired(SessionMiddleware::COOKIE_NAME, $this->secureCookie)
        );
    }
}
