<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Auth;

use App\Infra\Http\Cookie;
use App\Infra\Http\Middleware\SessionMiddleware;
use App\Infra\Http\Presenter\UserPresenter;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\UseCases\Auth\AuthenticateUserInput;
use App\UseCases\Auth\AuthenticateUserUseCase;

/**
 * A ÚNICA rota pública do sistema.
 *
 * Excepcionalidade deliberada e justificada, conforme exige o PADROES.md §5.1:
 * é a rota que cria a sessão, então não pode exigir sessão. Ela também é a
 * única isenta de CSRF, pela mesma razão — o token nasce aqui.
 *
 * Em compensação, é a única rota com limite de tentativas, aplicado dentro do
 * caso de uso.
 */
final class LoginRoute implements Route
{
    private function __construct(
        private readonly AuthenticateUserUseCase $useCase,
        private readonly bool $secureCookie,
    ) {
    }

    public static function create(AuthenticateUserUseCase $useCase, bool $secureCookie): self
    {
        return new self($useCase, $secureCookie);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::POST;
    }

    public function path(): string
    {
        return '/api/auth/login';
    }

    public function handle(Request $request): Response
    {
        // Campo a campo. O corpo inteiro nunca chega ao caso de uso.
        $output = $this->useCase->execute(new AuthenticateUserInput(
            email: $this->text($request->body('email')),
            password: $this->text($request->body('password')),
            ipAddress: $request->ip(),
            userAgent: $request->userAgent(),
        ));

        return Response::ok([
            'user' => UserPresenter::toArray($output->user),
            // O token vai no corpo, e não em cookie: o JavaScript precisa lê-lo
            // para enviá-lo no cabeçalho, e um token CSRF que o navegador manda
            // sozinho não protegeria de nada.
            'csrfToken' => $output->session->csrfToken,
        ])->withCookie(Cookie::session(
            name: SessionMiddleware::COOKIE_NAME,
            value: $output->session->id,
            expiresAt: $output->session->expiresAt->getTimestamp(),
            secure: $this->secureCookie,
        ));
    }

    /**
     * Converte para texto sem explodir com o que o cliente mandou.
     *
     * Um corpo com `{"email": {"$ne": null}}` faria um cast direto lançar
     * TypeError e virar 500 — quando a resposta correta é a recusa normal de
     * credencial inválida.
     */
    private function text(mixed $value): string
    {
        return is_string($value) ? $value : '';
    }
}
