<?php

declare(strict_types=1);

namespace Tests\Infra\Http;

use App\Infra\Http\Request;
use App\Shared\Enum\HttpMethod;
use Tests\TestCase;

final class RequestTest extends TestCase
{
    private function makeSut(array $overrides = []): Request
    {
        return Request::create(
            method: $overrides['method'] ?? HttpMethod::POST,
            path: $overrides['path'] ?? '/api/cards',
            query: $overrides['query'] ?? ['page' => '2', 'search' => 'lotus'],
            headers: $overrides['headers'] ?? ['X-CSRF-Token' => 'abc', 'Content-Type' => 'application/json'],
            server: $overrides['server'] ?? ['REMOTE_ADDR' => '10.0.0.7', 'HTTP_USER_AGENT' => 'Firefox'],
        );
    }

    public function testExpoeMetodoECaminho(): void
    {
        $sut = $this->makeSut();

        $this->assertSame(HttpMethod::POST, $sut->method);
        $this->assertSame('/api/cards', $sut->path);
    }

    public function testLeParametroDeQueryPorNome(): void
    {
        $sut = $this->makeSut();

        $this->assertSame('2', $sut->query('page'));
        $this->assertSame('lotus', $sut->query('search'));
        $this->assertNull($sut->query('inexistente'));
    }

    public function testLeCabecalhoSemDiferenciarMaiusculas(): void
    {
        $sut = $this->makeSut();

        $this->assertSame('abc', $sut->header('X-CSRF-Token'));
        $this->assertSame('abc', $sut->header('x-csrf-token'));
        $this->assertNull($sut->header('X-Ausente'));
    }

    public function testLeOCorpoCampoACampo(): void
    {
        $sut = $this->makeSut()->withBody(['nameEn' => 'Black Lotus', 'namePt' => null]);

        $this->assertSame('Black Lotus', $sut->body('nameEn'));
        $this->assertNull($sut->body('namePt'));
        $this->assertNull($sut->body('naoEnviado'));
    }

    public function testDistingueCampoAusenteDeCampoNulo(): void
    {
        $sut = $this->makeSut()->withBody(['namePt' => null]);

        // "não mandei o campo" e "mandei o campo vazio" são intenções
        // diferentes numa edição parcial.
        $this->assertTrue($sut->hasBody('namePt'));
        $this->assertFalse($sut->hasBody('nameEn'));
    }

    public function testNaoExpoeMetodoQueDevolvaOCorpoInteiro(): void
    {
        // Regra do PADROES.md §5.3: o corpo é desestruturado campo a campo.
        // Um getter do corpo inteiro é o que permite mass assignment — o
        // cliente escrevendo role_level, createdBy ou id.
        $publicos = get_class_methods(Request::class);

        foreach (['all', 'toArray', 'getBody', 'input', 'post', 'json'] as $proibido) {
            $this->assertFalse(
                in_array($proibido, $publicos, true),
                "Request não pode expor {$proibido}()."
            );
        }
    }

    public function testLeParametroDeRota(): void
    {
        $sut = $this->makeSut()->withRouteParams(['id' => '12']);

        $this->assertSame('12', $sut->param('id'));
    }

    public function testCarregaAtributosAnexadosPelosMiddlewares(): void
    {
        $sut = $this->makeSut()->withAttribute('traceId', 'f00d');

        $this->assertSame('f00d', $sut->attribute('traceId'));
        $this->assertNull($sut->attribute('naoAnexado'));
    }

    public function testPreservaImutabilidadeAoDerivar(): void
    {
        $original = $this->makeSut();
        $derivada = $original->withAttribute('traceId', 'f00d');

        $this->assertNull($original->attribute('traceId'));
        $this->assertSame('f00d', $derivada->attribute('traceId'));
    }

    public function testExpoeIpEUserAgentParaORegistroDeTentativas(): void
    {
        $sut = $this->makeSut();

        $this->assertSame('10.0.0.7', $sut->ip());
        $this->assertSame('Firefox', $sut->userAgent());
    }

    public function testReconheceMetodosDeEscrita(): void
    {
        $this->assertTrue($this->makeSut(['method' => HttpMethod::POST])->changesState());
        $this->assertTrue($this->makeSut(['method' => HttpMethod::PUT])->changesState());
        $this->assertTrue($this->makeSut(['method' => HttpMethod::DELETE])->changesState());
        $this->assertFalse($this->makeSut(['method' => HttpMethod::GET])->changesState());
    }

    /*
     * OF-001, achado pela auditoria final de 09/09 e reproduzido: `?page[]=1`
     * entrega um ARRAY em `$_GET`, e `strval` de array emite aviso. O front
     * controller converte aviso em exceção, e isso acontece DENTRO de
     * `fromGlobals()` — antes do pipeline, portanto antes de qualquer guard.
     * Toda rota `/api/*` respondia 500 a quem não estava autenticado, gravando
     * uma linha de log com a pilha inteira a cada requisição.
     *
     * O tipo declarado é `array<string,string>`. Quem não é string não é
     * parâmetro: some, e a rota trata como ausente — que é o que ela já sabe
     * fazer. Lançar aqui seria pior: `fromGlobals()` corre fora do
     * `ErrorBoundary`, e a resposta sairia sem os cabeçalhos de segurança.
     */
    public function testDescartaParametroDeQueryQueNaoSejaTexto(): void
    {
        $this->comGlobais(
            get: ['page' => ['1'], 'search' => 'lotus'],
            body: function (): void {
                $sut = Request::fromGlobals();

                $this->assertNull($sut->query('page'));
                $this->assertSame('lotus', $sut->query('search'));
            },
        );
    }

    public function testDescartaCookieQueNaoSejaTexto(): void
    {
        $this->comGlobais(
            cookie: ['ORACULOSID' => ['a' => 'b'], 'tema' => 'escuro'],
            body: function (): void {
                $sut = Request::fromGlobals();

                $this->assertNull($sut->cookie('ORACULOSID'));
                $this->assertSame('escuro', $sut->cookie('tema'));
            },
        );
    }

    public function testNumeroEmQueryContinuaVirandoTexto(): void
    {
        $this->comGlobais(
            get: ['page' => 2],
            body: function (): void {
                $this->assertSame('2', Request::fromGlobals()->query('page'));
            },
        );
    }

    /**
     * Troca as superglobais, roda o corpo e devolve tudo ao lugar — inclusive
     * quando o teste falha, que é quando o vazamento contaminaria o resto.
     *
     * @param array<mixed> $get
     * @param array<mixed> $cookie
     */
    private function comGlobais(callable $body, array $get = [], array $cookie = []): void
    {
        $getOriginal = $_GET;
        $cookieOriginal = $_COOKIE;

        $_GET = $get;
        $_COOKIE = $cookie;

        try {
            $body();
        } finally {
            $_GET = $getOriginal;
            $_COOKIE = $cookieOriginal;
        }
    }
}
