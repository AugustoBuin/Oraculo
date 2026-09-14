<?php

declare(strict_types=1);

namespace Tests\Infra\Http\Middleware;

use App\Domain\Errors\ForbiddenError;
use App\Domain\Session\Entity\Session;
use App\Infra\Http\Middleware\Csrf;
use App\Infra\Http\Middleware\SessionMiddleware;
use App\Infra\Http\Pipeline;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Shared\Enum\HttpMethod;
use Tests\Doubles\FrozenClock;
use Tests\TestCase;

final class CsrfTest extends TestCase
{
    private const LOGIN_PATH = '/api/auth/login';

    private Session $session;

    private function makeSut(): Csrf
    {
        $this->session = Session::start(7, 43200, (new FrozenClock())->now());

        return new Csrf([self::LOGIN_PATH]);
    }

    private function run(
        Csrf $sut,
        HttpMethod $method,
        ?string $token,
        bool $withSession = true,
        string $path = '/api/cards',
    ): Response {
        $request = Request::create(
            method: $method,
            path: $path,
            headers: $token === null ? [] : [Csrf::HEADER => $token],
        );

        if ($withSession) {
            $request = $request->withAttribute(SessionMiddleware::SESSION_ATTRIBUTE, $this->session);
        }

        return (new Pipeline([$sut]))->process($request, fn() => Response::ok(['ok' => true]));
    }

    public function testAceitaEscritaComTokenCorreto(): void
    {
        $sut = $this->makeSut();

        $response = $this->run($sut, HttpMethod::POST, $this->session->csrfToken);

        $this->assertTrue($response->body['data']['ok']);
    }

    public function testRecusaEscritaSemToken(): void
    {
        $sut = $this->makeSut();

        $this->assertThrows(
            ForbiddenError::class,
            fn() => $this->run($sut, HttpMethod::POST, null)
        );
    }

    public function testRecusaEscritaComTokenDivergente(): void
    {
        $sut = $this->makeSut();

        $this->assertThrows(
            ForbiddenError::class,
            fn() => $this->run($sut, HttpMethod::PUT, str_repeat('f', 64))
        );
    }

    public function testRecusaTokenApenasComPrefixoCorreto(): void
    {
        $sut = $this->makeSut();

        // hash_equals compara em tempo constante: acertar o começo não ajuda.
        $this->assertThrows(
            ForbiddenError::class,
            fn() => $this->run($sut, HttpMethod::DELETE, substr($this->session->csrfToken, 0, 40))
        );
    }

    public function testNaoExigeTokenEmLeitura(): void
    {
        $sut = $this->makeSut();

        $response = $this->run($sut, HttpMethod::GET, null);

        $this->assertTrue($response->body['data']['ok']);
    }

    public function testExigeTokenEmTodosOsVerbosDeEscrita(): void
    {
        $sut = $this->makeSut();

        foreach ([HttpMethod::POST, HttpMethod::PUT, HttpMethod::PATCH, HttpMethod::DELETE] as $method) {
            $this->assertThrows(
                ForbiddenError::class,
                fn() => $this->run($sut, $method, null),
                'O verbo ' . $method->value . ' precisa exigir token.'
            );
        }
    }

    public function testDeixaPassarEscritaSemSessao(): void
    {
        $sut = $this->makeSut();

        // Sem cookie não há credencial ambiente, logo não há o que falsificar.
        // Recusar aqui produziria 403 onde a resposta correta é 401, e o
        // frontend levaria o usuário à tela errada.
        $response = $this->run($sut, HttpMethod::POST, null, withSession: false);

        $this->assertTrue($response->body['data']['ok']);
    }

    public function testIsentaARotaQueCriaASessao(): void
    {
        $sut = $this->makeSut();

        $response = $this->run($sut, HttpMethod::POST, null, path: self::LOGIN_PATH);

        $this->assertTrue($response->body['data']['ok']);
    }

    public function testTrataBarraFinalNaIsencao(): void
    {
        $sut = $this->makeSut();

        $response = $this->run($sut, HttpMethod::POST, null, path: self::LOGIN_PATH . '/');

        $this->assertTrue($response->body['data']['ok']);
    }
}
