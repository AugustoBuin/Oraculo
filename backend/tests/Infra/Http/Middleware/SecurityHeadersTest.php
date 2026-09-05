<?php

declare(strict_types=1);

namespace Tests\Infra\Http\Middleware;

use App\Domain\Errors\NotFoundError;
use App\Infra\Http\ErrorHandler;
use App\Infra\Http\Middleware\SecurityHeaders;
use App\Infra\Http\Pipeline;
use App\Infra\Http\Request;
use App\Infra\Http\Response;
use App\Shared\Enum\HttpMethod;
use Tests\Doubles\SpyLogger;
use Tests\TestCase;

final class SecurityHeadersTest extends TestCase
{
    private function request(): Request
    {
        return Request::create(method: HttpMethod::GET, path: '/api/cards');
    }

    private function headersOf(Response $response): array
    {
        return $response->headers;
    }

    public function testAplicaOsCabecalhosDeSeguranca(): void
    {
        $sut = new Pipeline([new SecurityHeaders()]);

        $headers = $this->headersOf($sut->process($this->request(), fn() => Response::ok([])));

        $this->assertSame('nosniff', $headers['X-Content-Type-Options']);
        $this->assertSame('DENY', $headers['X-Frame-Options']);
        $this->assertSame('same-origin', $headers['Referrer-Policy']);
    }

    public function testDefineUmaPoliticaDeConteudoSemUnsafe(): void
    {
        $sut = new Pipeline([new SecurityHeaders()]);

        $csp = $this->headersOf($sut->process($this->request(), fn() => Response::ok([])))['Content-Security-Policy'];

        // unsafe-inline e unsafe-eval anulam a proteção contra XSS: com eles,
        // script injetado executa igual. A ausência deles obriga todo script e
        // todo estilo a virem de arquivo, que é bom padrão de qualquer forma.
        $this->assertFalse(str_contains($csp, 'unsafe-inline'));
        $this->assertFalse(str_contains($csp, 'unsafe-eval'));

        $this->assertTrue(str_contains($csp, "default-src 'self'"));
        $this->assertTrue(str_contains($csp, "object-src 'none'"));
        $this->assertTrue(str_contains($csp, "frame-ancestors 'none'"));

        // Carta pode ter imagem por URL externa (RF-31): é a única concessão.
        $this->assertTrue(str_contains($csp, 'img-src'));
    }

    public function testAplicaOsCabecalhosTambemNaRespostaDeErro(): void
    {
        $errorHandler = new ErrorHandler(new SpyLogger());
        $sut = new Pipeline([new SecurityHeaders()]);

        // Resposta de erro sem cabeçalho de segurança é uma superfície inteira
        // desprotegida — e é justamente o caminho menos testado.
        $response = $sut->process(
            $this->request(),
            fn() => $errorHandler->toResponse(new NotFoundError('Carta não encontrada.'))
        );

        $this->assertSame('nosniff', $this->headersOf($response)['X-Content-Type-Options']);
    }

    public function testNaoSobrescreveCabecalhoJaDefinidoPelaRota(): void
    {
        $sut = new Pipeline([new SecurityHeaders()]);

        $response = $sut->process(
            $this->request(),
            fn() => Response::ok([])->withHeader('Cache-Control', 'max-age=3600')
        );

        $this->assertSame('max-age=3600', $this->headersOf($response)['Cache-Control']);
        $this->assertSame('nosniff', $this->headersOf($response)['X-Content-Type-Options']);
    }
}
