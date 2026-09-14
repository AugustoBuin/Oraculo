<?php

declare(strict_types=1);

namespace Tests\Infra\Http;

use App\Infra\Http\Middleware\Middleware;
use App\Infra\Http\Pipeline;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Shared\Enum\HttpMethod;
use App\Shared\Enum\HttpStatus;
use Tests\TestCase;

/**
 * A Chain of Responsibility do pipeline HTTP (docs/decisions/ADR-005).
 *
 * Elimina o front controller procedural com condicional aninhada e a
 * duplicação da checagem de permissão em cada rota.
 */
final class PipelineTest extends TestCase
{
    /** Elo que registra a passagem numa lista compartilhada. */
    private function spy(string $nome, array &$trilha): Middleware
    {
        return new class ($nome, $trilha) implements Middleware {
            public function __construct(private string $nome, private array &$trilha)
            {
            }

            public function handle(Request $request, callable $next): Response
            {
                $this->trilha[] = "entra:{$this->nome}";
                $response = $next($request);
                $this->trilha[] = "sai:{$this->nome}";

                return $response;
            }
        };
    }

    /** Elo que responde sem chamar $next — curto-circuito. */
    private function shortCircuit(HttpStatus $status): Middleware
    {
        return new class ($status) implements Middleware {
            public function __construct(private HttpStatus $status)
            {
            }

            public function handle(Request $request, callable $next): Response
            {
                return Response::json($this->status, ['message' => 'interrompido']);
            }
        };
    }

    private function request(): Request
    {
        return Request::create(method: HttpMethod::GET, path: '/api/cards');
    }

    public function testExecutaOsElosNaOrdemDeclaradaEDesempilhaNaInversa(): void
    {
        $trilha = [];

        $sut = new Pipeline([
            $this->spy('primeiro', $trilha),
            $this->spy('segundo', $trilha),
        ]);

        $sut->process($this->request(), fn() => Response::ok([]));

        $this->assertSame(
            ['entra:primeiro', 'entra:segundo', 'sai:segundo', 'sai:primeiro'],
            $trilha
        );
    }

    public function testChegaAoDestinoQuandoTodosOsElosSeguem(): void
    {
        $sut = new Pipeline([]);

        $response = $sut->process($this->request(), fn() => Response::ok(['chegou' => true]));

        $this->assertTrue($response->body['data']['chegou']);
    }

    public function testInterrompeACadeiaQuandoUmEloNaoChamaOProximo(): void
    {
        $trilha = [];

        $sut = new Pipeline([
            $this->spy('primeiro', $trilha),
            $this->shortCircuit(HttpStatus::FORBIDDEN),
            $this->spy('nunca', $trilha),
        ]);

        $response = $sut->process($this->request(), fn() => Response::ok(['chegou' => true]));

        $this->assertSame(HttpStatus::FORBIDDEN, $response->status);
        // É isto que faz o guard funcionar: quem não passa, não alcança a rota.
        $this->assertFalse(in_array('entra:nunca', $trilha, true));
    }

    public function testEntregaAoProximoARequisicaoDerivadaPeloEloAnterior(): void
    {
        $sut = new Pipeline([
            new class implements Middleware {
                public function handle(Request $request, callable $next): Response
                {
                    return $next($request->withAttribute('traceId', 'f00d'));
                }
            },
        ]);

        $response = $sut->process(
            $this->request(),
            fn(Request $request) => Response::ok(['traceId' => $request->attribute('traceId')])
        );

        $this->assertSame('f00d', $response->body['data']['traceId']);
    }
}
