<?php

declare(strict_types=1);

namespace Tests\Infra\Http;

use App\Domain\Errors\MethodNotAllowedError;
use App\Domain\Errors\NotFoundError;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Infra\Http\Route;
use App\Infra\Http\Router;
use App\Shared\Enum\HttpMethod;
use App\Shared\Enum\HttpStatus;
use Tests\TestCase;

final class RouterTest extends TestCase
{
    /**
     * Rota anônima de teste. Devolve o que recebeu, para que as asserções
     * verifiquem o que o roteador entregou ao handler.
     */
    private function route(HttpMethod $method, string $path, ?callable $handler = null): Route
    {
        return new class ($method, $path, $handler) implements Route {
            public function __construct(
                private HttpMethod $method,
                private string $path,
                private $handler,
            ) {
            }

            public function method(): HttpMethod
            {
                return $this->method;
            }

            public function path(): string
            {
                return $this->path;
            }

            public function handle(Request $request): Response
            {
                if ($this->handler !== null) {
                    return ($this->handler)($request);
                }

                return Response::ok(['path' => $this->path]);
            }
        };
    }

    private function request(HttpMethod $method, string $path): Request
    {
        return Request::create(method: $method, path: $path);
    }

    public function testEncontraRotaExata(): void
    {
        $sut = new Router([$this->route(HttpMethod::GET, '/api/cards')]);

        $response = $sut->dispatch($this->request(HttpMethod::GET, '/api/cards'));

        $this->assertSame(HttpStatus::OK, $response->status);
    }

    public function testEntregaOsParametrosDeCaminhoAoHandler(): void
    {
        $capturado = null;

        $sut = new Router([
            $this->route(
                HttpMethod::GET,
                '/api/games/{gameId}/editions',
                function (Request $request) use (&$capturado): Response {
                    $capturado = $request->param('gameId');
                    return Response::ok([]);
                }
            ),
        ]);

        $sut->dispatch($this->request(HttpMethod::GET, '/api/games/magic/editions'));

        $this->assertSame('magic', $capturado);
    }

    public function testDistingueRotaEstaticaDeRotaComParametro(): void
    {
        $sut = new Router([
            $this->route(HttpMethod::GET, '/api/cards/{id}', fn() => Response::ok(['qual' => 'parametro'])),
            $this->route(HttpMethod::GET, '/api/cards/recentes', fn() => Response::ok(['qual' => 'estatica'])),
        ]);

        $response = $sut->dispatch($this->request(HttpMethod::GET, '/api/cards/recentes'));

        // A rota estática precisa vencer mesmo declarada depois: senão
        // /api/cards/recentes cairia no handler de {id} com id="recentes".
        $this->assertSame('estatica', $response->body['data']['qual']);
    }

    public function testCaminhoDesconhecidoLancaNotFound(): void
    {
        $sut = new Router([$this->route(HttpMethod::GET, '/api/cards')]);

        $this->assertThrows(
            NotFoundError::class,
            fn() => $sut->dispatch($this->request(HttpMethod::GET, '/api/inexistente'))
        );
    }

    public function testMetodoErradoEmCaminhoExistenteLancaMethodNotAllowed(): void
    {
        $sut = new Router([$this->route(HttpMethod::GET, '/api/cards')]);

        // 405 e não 404: o caminho existe, e responder 404 esconderia do cliente
        // que o problema é o verbo.
        $this->assertThrows(
            MethodNotAllowedError::class,
            fn() => $sut->dispatch($this->request(HttpMethod::DELETE, '/api/cards'))
        );
    }

    public function testNaoDeixaParametroAtravessarBarra(): void
    {
        $sut = new Router([$this->route(HttpMethod::GET, '/api/cards/{id}')]);

        // {id} casa um segmento só. Sem isso, /api/cards/12/history cairia no
        // handler de detalhe com id = "12/history".
        $this->assertThrows(
            NotFoundError::class,
            fn() => $sut->dispatch($this->request(HttpMethod::GET, '/api/cards/12/history'))
        );
    }

    public function testIgnoraBarraFinal(): void
    {
        $sut = new Router([$this->route(HttpMethod::GET, '/api/cards')]);

        $response = $sut->dispatch($this->request(HttpMethod::GET, '/api/cards/'));

        $this->assertSame(HttpStatus::OK, $response->status);
    }
}
