<?php

declare(strict_types=1);

namespace App\Infra\Http\Routes\Auth;

use App\Domain\User\Entity\User;
use App\Infra\Http\Cookie;
use App\Infra\Http\Guard;
use App\Infra\Http\Middleware\SessionMiddleware;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Shared\Enum\HttpMethod;
use App\UseCases\Auth\ChangePasswordInput;
use App\UseCases\Auth\ChangePasswordUseCase;

/**
 * Troca a própria senha.
 *
 * "Própria" não é uma escolha de escopo: o `userId` vem da SESSÃO, e o corpo da
 * requisição só carrega as duas senhas. Aceitar um `userId` do cliente
 * transformaria esta rota em "troque a senha de quem eu quiser".
 *
 * Como a operação encerra todas as sessões — inclusive a de quem está pedindo —,
 * a resposta já limpa o cookie: sem isso o navegador continuaria mandando um id
 * de sessão morto e o usuário veria um 401 inesperado no clique seguinte.
 */
final class ChangePasswordRoute implements Route
{
    private function __construct(
        private readonly ChangePasswordUseCase $useCase,
        private readonly bool $secureCookie,
    ) {
    }

    public static function create(ChangePasswordUseCase $useCase, bool $secureCookie): self
    {
        return new self($useCase, $secureCookie);
    }

    public function method(): HttpMethod
    {
        return HttpMethod::PUT;
    }

    public function path(): string
    {
        return '/api/auth/password';
    }

    public function handle(Request $request): Response
    {
        /** @var User $user o guard já garantiu que existe */
        $user = $request->attribute(Guard::USER_ATTRIBUTE);

        $this->useCase->execute(new ChangePasswordInput(
            userId: $user->id,
            currentPassword: $this->text($request->body('currentPassword')),
            newPassword: $this->text($request->body('newPassword')),
        ));

        return Response::noContent()->withCookie(
            Cookie::expired(SessionMiddleware::COOKIE_NAME, $this->secureCookie)
        );
    }

    private function text(mixed $value): string
    {
        return is_string($value) ? $value : '';
    }
}
